mock_provider "aws" {}

variables {
  name                     = "cse-test"
  vpc_id                   = "vpc-0123456789abcdef0"
  subnet_ids               = ["subnet-a", "subnet-b", "subnet-c"]
  client_security_group_id = "sg-0123456789abcdef0"
  kms_key_arn              = "arn:aws:kms:eu-central-1:123456789012:key/mock"
}

run "private_encrypted_and_tls_only" {
  command = plan

  assert {
    condition     = aws_db_instance.this.publicly_accessible == false
    error_message = "The database must not be publicly accessible."
  }
  assert {
    condition     = aws_db_instance.this.storage_encrypted && aws_db_instance.this.kms_key_id == var.kms_key_arn
    error_message = "Storage must be encrypted with the environment key."
  }
  assert {
    condition     = aws_db_instance.this.manage_master_user_password == true
    error_message = "The master password is managed by RDS in Secrets Manager (never in state)."
  }
  assert {
    condition     = one([for p in aws_db_parameter_group.this.parameter : p.value if p.name == "rds.force_ssl"]) == "1"
    error_message = "Connections must use TLS."
  }
  assert {
    condition     = aws_db_instance.this.deletion_protection && !aws_db_instance.this.skip_final_snapshot
    error_message = "Deletion protection and a final snapshot by default."
  }
  assert {
    condition     = aws_vpc_security_group_ingress_rule.from_cluster.referenced_security_group_id == var.client_security_group_id && aws_vpc_security_group_ingress_rule.from_cluster.cidr_ipv4 == null
    error_message = "Only the cluster's security group may connect (no CIDR rules)."
  }
}
