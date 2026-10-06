mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["eu-central-1a", "eu-central-1b", "eu-central-1c"] }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:eu-central-1:123456789012:log-group:mock" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/mock" }
  }
}

variables {
  name            = "cse-test"
  region          = "eu-central-1"
  cidr            = "10.30.0.0/16"
  log_kms_key_arn = "arn:aws:kms:eu-central-1:123456789012:key/mock"
}

run "three_tiers_in_three_zones" {
  # apply (against the mock) so the route tables' computed routes are known.
  command = apply

  assert {
    condition     = length(aws_subnet.public) == 3 && length(aws_subnet.private) == 3 && length(aws_subnet.data) == 3
    error_message = "Each tier spans three zones."
  }
  assert {
    condition     = length(aws_route_table.data.route) == 0 && alltrue([for a in aws_route_table_association.data : a.route_table_id == aws_route_table.data.id])
    error_message = "Data subnets use a route table with no route out of the VPC."
  }
  assert {
    condition     = length(aws_nat_gateway.this) == 3
    error_message = "Production: one NAT gateway per zone."
  }
  assert {
    condition = length(distinct(concat(
      aws_subnet.public[*].cidr_block, aws_subnet.private[*].cidr_block, aws_subnet.data[*].cidr_block,
    ))) == 9
    error_message = "Subnet ranges must not overlap."
  }
}

run "staging_shares_one_nat" {
  command = plan
  variables {
    single_nat_gateway = true
  }
  assert {
    condition     = length(aws_nat_gateway.this) == 1
    error_message = "single_nat_gateway uses one NAT gateway."
  }
}

run "rejects_a_non_16_cidr" {
  command = plan
  variables {
    cidr = "10.30.0.0/20"
  }
  expect_failures = [var.cidr]
}
