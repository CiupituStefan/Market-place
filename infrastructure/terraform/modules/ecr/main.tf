# One repository per image. Tags are immutable (a Git SHA always means the same image),
# images are scanned on push, and old images expire (with their attestations).
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

variable "prefix" {
  type    = string
  default = "cse"
}

variable "repositories" {
  type = list(string)
}

variable "kms_key_arn" {
  type = string
}

variable "keep_images" {
  description = "Images kept per repository (enough for rollbacks)."
  type        = number
  default     = 50
}

resource "aws_ecr_repository" "this" {
  for_each             = toset(var.repositories)
  name                 = "${var.prefix}/${each.value}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }
}

# Only tagged images are counted and expired. Everything untagged in these repositories is a
# referrer (the signed provenance and SBOM attestations admission control requires): ECR expires
# those itself within a day of their image, and an "untagged" or "any" rule could drop them
# first, after which the image could no longer be scheduled, nor rolled back to.
resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the most recent images for rollbacks"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["*"]
          countType      = "imageCountMoreThan"
          countNumber    = var.keep_images
        }
        action = { type = "expire" }
      },
    ]
  })
}

output "repository_urls" {
  value = { for name, repo in aws_ecr_repository.this : name => repo.repository_url }
}

output "repository_arns" {
  value = [for repo in aws_ecr_repository.this : repo.arn]
}

output "registry" {
  value = split("/", values(aws_ecr_repository.this)[0].repository_url)[0]
}
