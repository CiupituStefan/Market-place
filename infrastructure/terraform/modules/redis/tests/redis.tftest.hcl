mock_provider "aws" {}

variables {
  name                     = "cse-test"
  vpc_id                   = "vpc-0123456789abcdef0"
  subnet_ids               = ["subnet-a", "subnet-b", "subnet-c"]
  client_security_group_id = "sg-0123456789abcdef0"
  kms_key_arn              = "arn:aws:kms:eu-central-1:123456789012:key/mock"
  secret_name              = "cse/test/redis"
}

run "tls_required_and_encrypted" {
  command = plan

  assert {
    condition     = aws_elasticache_replication_group.this.transit_encryption_enabled && aws_elasticache_replication_group.this.transit_encryption_mode == "required"
    error_message = "Clients must use TLS."
  }
  assert {
    condition     = aws_elasticache_replication_group.this.at_rest_encryption_enabled
    error_message = "Data at rest must be encrypted."
  }
  assert {
    condition     = aws_elasticache_replication_group.this.automatic_failover_enabled && aws_elasticache_replication_group.this.num_cache_clusters == 2
    error_message = "With a replica, failover is automatic."
  }
}

run "single_node_without_replicas" {
  command = plan
  variables {
    replicas = 0
  }
  assert {
    condition     = !aws_elasticache_replication_group.this.automatic_failover_enabled
    error_message = "No failover without a replica."
  }
}
