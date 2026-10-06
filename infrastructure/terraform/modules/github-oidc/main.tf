# GitHub Actions authenticates to AWS with OIDC: short-lived credentials for a given
# repository and branch/environment, no access keys stored in GitHub.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

variable "repository" {
  # The token's `sub` claim carries the name exactly as GitHub displays it, and the trust
  # policy comparison is case-sensitive: "Owner/Repo", not "owner/repo".
  description = "owner/name, with GitHub's capitalisation."
  type        = string
  validation {
    condition     = can(regex("^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$", var.repository))
    error_message = "repository must be owner/name."
  }
}

variable "create_provider" {
  description = "The OIDC provider exists once per account."
  type        = bool
  default     = true
}

variable "roles" {
  description = "Role name → allowed subject patterns and inline policy."
  type = map(object({
    subjects    = list(string)
    policy_json = string
  }))
}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.create_provider ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  provider_arn = var.create_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
}

resource "aws_iam_role" "this" {
  for_each             = var.roles
  name                 = each.key
  max_session_duration = 3600
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [for s in each.value.subjects : "repo:${var.repository}:${s}"]
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "this" {
  for_each = var.roles
  role     = aws_iam_role.this[each.key].id
  policy   = each.value.policy_json
}

output "role_arns" {
  value = { for name, role in aws_iam_role.this : name => role.arn }
}
