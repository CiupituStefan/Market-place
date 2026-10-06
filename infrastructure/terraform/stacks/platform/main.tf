# Cluster add-ons for one environment, after its infra stack. Reads the cluster's details
# from the infra state; authenticates to Kubernetes with short-lived EKS tokens.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 6.0" }
    helm       = { source = "hashicorp/helm", version = "~> 3.0" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 3.0" }
  }
  backend "s3" {}
}

variable "environment" {
  type = string
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "domain" {
  type = string
}

variable "state_bucket" {
  type = string
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { project = "cse-keyboards", environment = var.environment, managed-by = "terraform", stack = "platform" }
  }
}

data "terraform_remote_state" "infra" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "${var.environment}/infra.tfstate"
    region = var.region
  }
}

locals {
  infra = data.terraform_remote_state.infra.outputs
  exec = {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", local.infra.cluster_name, "--region", var.region]
  }
}

provider "kubernetes" {
  host                   = local.infra.cluster_endpoint
  cluster_ca_certificate = base64decode(local.infra.cluster_ca)
  exec {
    api_version = local.exec.api_version
    command     = local.exec.command
    args        = local.exec.args
  }
}

provider "helm" {
  kubernetes = {
    host                   = local.infra.cluster_endpoint
    cluster_ca_certificate = base64decode(local.infra.cluster_ca)
    exec = {
      api_version = local.exec.api_version
      command     = local.exec.command
      args        = local.exec.args
    }
  }
}

module "platform" {
  source               = "../../modules/platform"
  name                 = "cse-${var.environment}"
  cluster_name         = local.infra.cluster_name
  vpc_id               = local.infra.vpc_id
  oidc_provider_arn    = local.infra.oidc_provider_arn
  oidc_issuer          = local.infra.oidc_issuer
  kms_key_arn          = local.infra.kms_key_arn
  secret_name_prefixes = local.infra.secret_name_prefixes
  zone_id              = local.infra.zone_id
  domain               = var.domain
  app_namespace        = local.infra.app_namespace
  deployers_group      = local.infra.deployers_group
  observability        = local.infra.observability
  admission            = local.infra.admission
  kafka                = local.infra.kafka
}
