# Amazon MSK: brokers in the data subnets, TLS between clients and brokers and inside the
# cluster, SASL/SCRAM only (no unauthenticated access). One SCRAM user per service; its
# password is generated ephemerally and written only to Secrets Manager (write-only), under
# the AmazonMSK_ prefix MSK requires, encrypted with a customer-managed key.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
  }
}

resource "aws_security_group" "this" {
  name        = "${var.name}-msk"
  description = "MSK SASL/SCRAM over TLS: EKS nodes only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-msk" }
}

resource "aws_vpc_security_group_ingress_rule" "from_cluster" {
  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = var.client_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 9096
  to_port                      = 9096
  description                  = "SASL/SCRAM over TLS from EKS"
}

resource "aws_msk_configuration" "this" {
  name           = var.name
  kafka_versions = [var.kafka_version]
  server_properties = join("\n", [
    # Services create their own topics (ADR-018); nothing is created by accident.
    "auto.create.topics.enable=false",
    "default.replication.factor=3",
    "min.insync.replicas=2",
    "unclean.leader.election.enable=false",
    "num.partitions=6",
    # Authenticated clients only (SASL/SCRAM); per-topic ACLs tighten this further.
    "allow.everyone.if.no.acl.found=${var.allow_all_authenticated}",
  ])
}

resource "aws_cloudwatch_log_group" "this" {
  #checkov:skip=CKV_AWS_338:Broker logs are operational, not audit: 30 days.
  name              = "/aws/msk/${var.name}"
  retention_in_days = 30
  kms_key_id        = var.kms_key_arn
}

resource "aws_msk_cluster" "this" {
  cluster_name           = var.name
  kafka_version          = var.kafka_version
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.subnet_ids
    security_groups = [aws_security_group.this.id]
    storage_info {
      ebs_storage_info { volume_size = var.broker_volume_gb }
    }
  }

  client_authentication {
    unauthenticated = false
    sasl { scram = true }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = var.kms_key_arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.this.arn
    revision = aws_msk_configuration.this.latest_revision
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.this.name
      }
    }
  }
}

# ── one SCRAM user per service ─────────────────────────────────────────────────

ephemeral "random_password" "user" {
  for_each = toset(var.users)
  length   = 40
  special  = false
}

resource "aws_secretsmanager_secret" "user" {
  #checkov:skip=CKV2_AWS_57:Rotated by increasing credentials_version (new ephemeral password, written only to the secret).
  for_each    = toset(var.users)
  name        = "AmazonMSK_${var.name}_${each.value}"
  description = "MSK SASL/SCRAM credentials of ${each.value}"
  kms_key_id  = var.kms_key_arn
}

resource "aws_secretsmanager_secret_version" "user" {
  for_each  = toset(var.users)
  secret_id = aws_secretsmanager_secret.user[each.value].id
  secret_string_wo = jsonencode({
    username = each.value
    password = ephemeral.random_password.user[each.value].result
  })
  secret_string_wo_version = var.credentials_version
}

# MSK reads these secrets; its service principal needs the policy.
resource "aws_secretsmanager_secret_policy" "user" {
  for_each   = toset(var.users)
  secret_arn = aws_secretsmanager_secret.user[each.value].arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AWSKafkaResourcePolicy"
      Effect    = "Allow"
      Principal = { Service = "kafka.amazonaws.com" }
      Action    = "secretsmanager:GetSecretValue"
      Resource  = aws_secretsmanager_secret.user[each.value].arn
    }]
  })
}

resource "aws_msk_single_scram_secret_association" "user" {
  for_each    = toset(var.users)
  cluster_arn = aws_msk_cluster.this.arn
  secret_arn  = aws_secretsmanager_secret.user[each.value].arn
  depends_on  = [aws_secretsmanager_secret_version.user, aws_secretsmanager_secret_policy.user]
}
