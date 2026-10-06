# Plans the whole environment against mocked providers (no AWS account needed) and asserts
# the properties that must never regress. Run: terraform test (from this directory).

mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["eu-central-1a", "eu-central-1b", "eu-central-1c"] }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
  mock_data "aws_region" {
    defaults = { region = "eu-central-1" }
  }
  mock_data "aws_route53_zone" {
    defaults = { zone_id = "Z0123456789ABCDEFGHIJ" }
  }
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
  mock_data "aws_cloudfront_cache_policy" {
    defaults = { id = "658327ea-f89d-4fab-a63d-7e88639e58f6" }
  }
  mock_data "aws_iam_openid_connect_provider" {
    defaults = { arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" }
  }
  mock_resource "aws_kms_key" {
    defaults = { arn = "arn:aws:kms:eu-central-1:123456789012:key/00000000-0000-0000-0000-000000000000" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/mock" }
  }
  mock_resource "aws_msk_configuration" {
    defaults = { arn = "arn:aws:kafka:eu-central-1:123456789012:configuration/cse/mock" }
  }
  mock_resource "aws_msk_cluster" {
    defaults = {
      arn                          = "arn:aws:kafka:eu-central-1:123456789012:cluster/cse/mock"
      bootstrap_brokers_sasl_scram = "b-1.cse.mock.kafka.eu-central-1.amazonaws.com:9096"
    }
  }
  mock_resource "aws_launch_template" {
    defaults = { id = "lt-0123456789abcdef0", latest_version = 1 }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:eu-central-1:123456789012:log-group:mock" }
  }
  mock_resource "aws_wafv2_web_acl" {
    defaults = { arn = "arn:aws:wafv2:eu-central-1:123456789012:regional/webacl/cse/mock" }
  }
  mock_resource "aws_eks_cluster" {
    defaults = {
      identity              = [{ oidc = [{ issuer = "https://oidc.eks.eu-central-1.amazonaws.com/id/MOCK" }] }]
      vpc_config            = { cluster_security_group_id = "sg-0123456789abcdef0" }
      certificate_authority = [{ data = "bW9jaw==" }]
    }
  }
  mock_resource "aws_db_instance" {
    defaults = { master_user_secret = [{ secret_arn = "arn:aws:secretsmanager:eu-central-1:123456789012:secret:rds-mock" }] }
  }
  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::mock-bucket" }
  }
  mock_resource "aws_secretsmanager_secret" {
    defaults = { arn = "arn:aws:secretsmanager:eu-central-1:123456789012:secret:mock" }
  }
  mock_resource "aws_acm_certificate" {
    defaults = { arn = "arn:aws:acm:eu-central-1:123456789012:certificate/mock" }
  }
  mock_resource "aws_cloudfront_distribution" {
    defaults = { arn = "arn:aws:cloudfront::123456789012:distribution/MOCK" }
  }
}

# Computed nested attributes the mocks leave empty (unknown until apply in a real plan).
# SES identity's DKIM tokens are a computed block mocks cannot fill; the module is covered
# by validate/checkov, the stack test only needs its outputs.
override_module {
  target = module.ses
  outputs = {
    identity_arn      = "arn:aws:ses:eu-central-1:123456789012:identity/csekeyboards.com"
    configuration_set = "cse-production"
  }
}

override_resource {
  override_during = plan
  target          = aws_acm_certificate.app
  values = {
    arn                 = "arn:aws:acm:eu-central-1:123456789012:certificate/app"
    id                  = "arn:aws:acm:eu-central-1:123456789012:certificate/app"
    key_algorithm       = "RSA_2048"
    not_after           = "2027-10-05T00:00:00Z"
    not_before          = "2026-10-05T00:00:00Z"
    region              = "eu-central-1"
    renewal_eligibility = "ELIGIBLE"
    status              = "ISSUED"
    type                = "AMAZON_ISSUED"
    domain_validation_options = [
      { domain_name = "www.csekeyboards.com", resource_record_name = "_a.www", resource_record_type = "CNAME", resource_record_value = "_a.acm" },
      { domain_name = "api.csekeyboards.com", resource_record_name = "_a.api", resource_record_type = "CNAME", resource_record_value = "_b.acm" },
    ]
  }
}

override_resource {
  override_during = plan
  target          = module.assets.aws_acm_certificate.cdn
  values = {
    arn                 = "arn:aws:acm:us-east-1:123456789012:certificate/cdn"
    id                  = "arn:aws:acm:us-east-1:123456789012:certificate/cdn"
    key_algorithm       = "RSA_2048"
    not_after           = "2027-10-05T00:00:00Z"
    not_before          = "2026-10-05T00:00:00Z"
    region              = "us-east-1"
    renewal_eligibility = "ELIGIBLE"
    status              = "ISSUED"
    type                = "AMAZON_ISSUED"
    domain_validation_options = [
      { domain_name = "cdn.csekeyboards.com", resource_record_name = "_a.cdn", resource_record_type = "CNAME", resource_record_value = "_c.acm" },
    ]
  }
}

mock_provider "aws" {
  alias = "us_east_1"
  mock_resource "aws_acm_certificate" {
    defaults = { arn = "arn:aws:acm:us-east-1:123456789012:certificate/mock" }
  }
}

# The real random provider runs locally (ephemeral resources cannot be mocked).

mock_provider "tls" {
  mock_data "tls_certificate" {
    defaults = { certificates = [{ sha1_fingerprint = "9e99a48a9960b14926bb7f3b02e22da2b0ab7280" }] }
  }
}

variables {
  environment             = "production"
  vpc_cidr                = "10.30.0.0/16"
  domain                  = "csekeyboards.com"
  web_host                = "www.csekeyboards.com"
  api_host                = "api.csekeyboards.com"
  cdn_host                = "cdn.csekeyboards.com"
  github_repository       = "CiupituStefan/Market-place"
  cluster_admin_role_arns = ["arn:aws:iam::123456789012:role/AWSReservedSSO_Admin"]
  dmarc_report_address    = "dmarc@csekeyboards.com"
  sizing = {
    single_nat_gateway  = false
    node_instance_types = ["m7i.large"]
    node_min            = 3
    node_max            = 12
    db_instance_class   = "db.m7g.large"
    db_multi_az         = true
    db_storage_gb       = 100
    db_backup_days      = 14
    redis_node_type     = "cache.t4g.small"
    redis_replicas      = 1
    kafka_broker_type   = "kafka.m7g.large"
  }
}

# "apply" against mocked providers: nothing reaches AWS, but computed values become known.
run "builds_a_whole_environment" {
  command = apply

  assert {
    condition     = output.app_namespace == "cse-production"
    error_message = "The application namespace follows the environment."
  }

  assert {
    condition     = output.secret_name_prefixes == ["cse/production/", "AmazonMSK_cse-production_"]
    error_message = "External Secrets may read this environment's secrets only."
  }

  assert {
    condition     = yamldecode(output.helm_values).global.externalSecrets.keyPrefix == "cse/production"
    error_message = "Helm values point at this environment's secrets."
  }

  assert {
    condition     = yamldecode(output.helm_values).global.ingress.loadBalancerCidrs == ["10.30.0.0/16"]
    error_message = "Network policies admit the load balancer from the VPC only."
  }

  assert {
    condition     = !strcontains(output.helm_values, "password") && !strcontains(output.helm_values, "secret_string")
    error_message = "Helm values must not contain secrets."
  }
}

run "staging_is_smaller" {
  command = plan

  variables {
    environment = "staging"
    vpc_cidr    = "10.20.0.0/16"
    web_host    = "staging.csekeyboards.com"
    api_host    = "api.staging.csekeyboards.com"
    cdn_host    = "cdn.staging.csekeyboards.com"
    sizing = {
      single_nat_gateway  = true
      node_instance_types = ["t3a.large"]
      node_min            = 2
      node_max            = 4
      db_instance_class   = "db.t4g.small"
      db_multi_az         = false
      db_storage_gb       = 20
      db_backup_days      = 7
      redis_node_type     = "cache.t4g.micro"
      redis_replicas      = 0
      kafka_broker_type   = "kafka.t3.small"
    }
  }

  assert {
    condition     = output.app_namespace == "cse-staging"
    error_message = "Staging gets its own namespace."
  }
}

run "rejects_an_unknown_environment" {
  command = plan

  variables {
    environment = "dev"
  }

  expect_failures = [var.environment]
}
