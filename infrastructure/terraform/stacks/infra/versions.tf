terraform {
  # Ephemeral resources and write-only arguments keep generated credentials out of state.
  required_version = ">= 1.11.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
    tls    = { source = "hashicorp/tls", version = "~> 4.0" }
  }
  # Partial configuration: envs/<environment>/infra.backend.hcl
  backend "s3" {}
}

# Credentials come from the environment (SSO profile locally, GitHub OIDC in CI): never here.
provider "aws" {
  region = var.region
  default_tags {
    tags = {
      project     = "cse-keyboards"
      environment = var.environment
      managed-by  = "terraform"
      stack       = "infra"
    }
  }
}

# CloudFront certificates and CLOUDFRONT-scope resources live in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      project     = "cse-keyboards"
      environment = var.environment
      managed-by  = "terraform"
      stack       = "infra"
    }
  }
}
