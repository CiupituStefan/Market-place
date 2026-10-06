# Valkey (Redis-compatible) for the API gateway's rate limits. TLS in transit, encrypted at
# rest, AUTH token generated ephemerally and written only to ElastiCache and Secrets Manager
# (write-only arguments): it is never stored in Terraform state.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
  }
}

ephemeral "random_password" "auth" {
  length  = 48
  special = false
}

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "this" {
  name        = "${var.name}-redis"
  description = "Valkey: EKS nodes only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-redis" }
}

resource "aws_vpc_security_group_ingress_rule" "from_cluster" {
  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = var.client_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
  description                  = "EKS nodes and pods"
}

resource "aws_elasticache_replication_group" "this" {
  #checkov:skip=CKV_AWS_31:TLS is required and the AUTH token is set through the write-only auth_token_wo, which checkov does not recognise.
  #checkov:skip=CKV2_AWS_50:Failover follows var.replicas (production: 1 replica, Multi-AZ; staging: single node).
  replication_group_id = var.name
  description          = "CSE rate limiting (${var.name})"
  engine               = "valkey"
  engine_version       = "8.0"
  node_type            = var.node_type
  num_cache_clusters   = var.replicas + 1
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  automatic_failover_enabled = var.replicas > 0
  multi_az_enabled           = var.replicas > 0
  at_rest_encryption_enabled = true
  kms_key_id                 = var.kms_key_arn
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"

  auth_token_wo         = ephemeral.random_password.auth.result
  auth_token_wo_version = var.auth_token_version

  snapshot_retention_limit   = 1
  auto_minor_version_upgrade = true
  apply_immediately          = false
}

resource "aws_secretsmanager_secret" "url" {
  #checkov:skip=CKV2_AWS_57:Rotated by increasing auth_token_version (ElastiCache and the secret change together).
  name        = var.secret_name
  description = "rediss:// URL with AUTH token for the API gateway"
  kms_key_id  = var.kms_key_arn
}

resource "aws_secretsmanager_secret_version" "url" {
  secret_id = aws_secretsmanager_secret.url.id
  secret_string_wo = jsonencode({
    url = "rediss://:${ephemeral.random_password.auth.result}@${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
  })
  secret_string_wo_version = var.auth_token_version
}
