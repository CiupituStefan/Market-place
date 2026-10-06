# One Secrets Manager entry per component (cse/<environment>/<component>), encrypted with the
# environment's key. Terraform creates the containers only: application secrets (database
# URLs, Stripe keys, JWT signing key...) are put by an operator or a rotation job and never
# pass through Terraform. External Secrets syncs them into the cluster (ADR-018).
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

variable "prefix" {
  description = "e.g. cse/production"
  type        = string
}

variable "components" {
  type = list(string)
}

variable "kms_key_arn" {
  type = string
}

variable "recovery_window_days" {
  type    = number
  default = 30
}

resource "aws_secretsmanager_secret" "this" {
  #checkov:skip=CKV2_AWS_57:Values are application-owned (Stripe keys, JWT key, database roles); rotation is a runbook, not a Lambda.
  for_each                = toset(var.components)
  name                    = "${var.prefix}/${each.value}"
  description             = "Application secrets of ${each.value} (JSON object; see infrastructure/helm/README.md)"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.recovery_window_days
}

output "arns" {
  value = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
}
