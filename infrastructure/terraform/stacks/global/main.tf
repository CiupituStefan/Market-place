# Account-wide, applied once: container registries and the GitHub OIDC provider with the
# role CI uses to push images. Environments live in the infra/platform stacks.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { project = "cse-keyboards", managed-by = "terraform", stack = "global" }
  }
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "github_repository" {
  type = string
}

locals {
  images = [
    "web", "api-gateway", "auth-service", "product-service", "inventory-service", "cart-service",
    "order-service", "payment-service", "notification-service", "review-service", "admin-service",
  ]
}

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "ecr" {
  description         = "CSE container images"
  enable_key_rotation = true
  # Access is granted through IAM policies of this account (the build role, the nodes).
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AccountAdministration"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
      Action    = "kms:*"
      Resource  = "*"
    }]
  })
}

module "ecr" {
  source       = "../../modules/ecr"
  repositories = local.images
  kms_key_arn  = aws_kms_key.ecr.arn
}

module "github" {
  source     = "../../modules/github-oidc"
  repository = var.github_repository
  roles = {
    "cse-github-build" = {
      # Images are built and pushed from main only; pull requests build without pushing.
      subjects = ["ref:refs/heads/main"]
      policy_json = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Sid      = "Login"
            Effect   = "Allow"
            Action   = "ecr:GetAuthorizationToken"
            Resource = "*"
          },
          {
            Sid    = "PushToTheShopRepositories"
            Effect = "Allow"
            Action = [
              "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
              "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage",
              "ecr:DescribeImages", "ecr:DescribeImageScanFindings",
            ]
            Resource = module.ecr.repository_arns
          },
          {
            Sid      = "EncryptLayers"
            Effect   = "Allow"
            Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
            Resource = aws_kms_key.ecr.arn
          },
        ]
      })
    }
  }
}

output "registry" {
  value = module.ecr.registry
}

output "build_role_arn" {
  value = module.github.role_arns["cse-github-build"]
}
