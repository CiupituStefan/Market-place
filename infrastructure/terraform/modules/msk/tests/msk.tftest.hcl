mock_provider "aws" {
  mock_resource "aws_msk_configuration" {
    defaults = { arn = "arn:aws:kafka:eu-central-1:123456789012:configuration/cse/mock" }
  }
}

variables {
  name                     = "cse-test"
  vpc_id                   = "vpc-0123456789abcdef0"
  subnet_ids               = ["subnet-a", "subnet-b", "subnet-c"]
  client_security_group_id = "sg-0123456789abcdef0"
  kms_key_arn              = "arn:aws:kms:eu-central-1:123456789012:key/mock"
  users                    = ["order-service", "payment-service"]
}

run "authenticated_tls_only" {
  command = plan

  assert {
    condition     = aws_msk_cluster.this.client_authentication[0].unauthenticated == false && aws_msk_cluster.this.client_authentication[0].sasl[0].scram == true
    error_message = "SASL/SCRAM only, no anonymous clients."
  }
  assert {
    condition     = aws_msk_cluster.this.encryption_info[0].encryption_in_transit[0].client_broker == "TLS" && aws_msk_cluster.this.encryption_info[0].encryption_in_transit[0].in_cluster
    error_message = "TLS between clients and brokers and inside the cluster."
  }
  assert {
    condition     = strcontains(aws_msk_configuration.this.server_properties, "auto.create.topics.enable=false") && strcontains(aws_msk_configuration.this.server_properties, "min.insync.replicas=2")
    error_message = "No accidental topics; acknowledged writes survive a broker loss."
  }
  assert {
    condition     = toset(keys(aws_secretsmanager_secret.user)) == toset(var.users) && alltrue([for s in aws_secretsmanager_secret.user : startswith(s.name, "AmazonMSK_") && s.kms_key_id == var.kms_key_arn])
    error_message = "One SCRAM secret per service, named and encrypted as MSK requires."
  }
}
