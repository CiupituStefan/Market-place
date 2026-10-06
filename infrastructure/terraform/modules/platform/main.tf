# Cluster add-ons the application chart relies on (ADR-018), each with its own IRSA role:
#   AWS Load Balancer Controller — ALB for the Ingress, WAF association
#   External Secrets Operator    — Secrets Manager → Kubernetes Secrets (read-only, this env)
#   ExternalDNS                  — Route 53 records for the ingress hosts (this zone only)
#   metrics-server               — CPU metrics for the HPAs
# plus the application namespace, enforcing the "restricted" Pod Security Standard.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 6.0" }
    helm       = { source = "hashicorp/helm", version = "~> 3.0" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 3.0" }
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_region" "current" {}

locals {
  account = data.aws_caller_identity.current.account_id
  region  = data.aws_region.current.region
  arn     = "arn:${data.aws_partition.current.partition}"
}

# ── application namespace ─────────────────────────────────────────────────────

resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = var.app_namespace
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted"
      "pod-security.kubernetes.io/audit"   = "restricted"
      "pod-security.kubernetes.io/warn"    = "restricted"
    }
  }
}

# ── AWS Load Balancer Controller ──────────────────────────────────────────────

module "alb_controller_role" {
  source            = "../irsa-role"
  name              = "${var.name}-aws-load-balancer-controller"
  oidc_provider_arn = var.oidc_provider_arn
  oidc_issuer       = var.oidc_issuer
  namespace         = "kube-system"
  service_account   = "aws-load-balancer-controller"
  # Upstream policy for the pinned controller version.
  policy_json = file("${path.module}/policies/aws-load-balancer-controller.json")
}

resource "helm_release" "alb_controller" {
  name       = "aws-load-balancer-controller"
  namespace  = "kube-system"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "3.6.0"
  values = [yamlencode({
    clusterName  = var.cluster_name
    region       = local.region
    vpcId        = var.vpc_id
    replicaCount = 2
    serviceAccount = {
      name        = "aws-load-balancer-controller"
      annotations = { "eks.amazonaws.com/role-arn" = module.alb_controller_role.arn }
    }
  })]
}

# ── External Secrets ──────────────────────────────────────────────────────────

module "external_secrets_role" {
  source            = "../irsa-role"
  name              = "${var.name}-external-secrets"
  oidc_provider_arn = var.oidc_provider_arn
  oidc_issuer       = var.oidc_issuer
  namespace         = "external-secrets"
  service_account   = "external-secrets"
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadThisEnvironmentsSecrets"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = [for prefix in var.secret_name_prefixes :
        "${local.arn}:secretsmanager:${local.region}:${local.account}:secret:${prefix}*"]
      },
      {
        Sid      = "DecryptWithTheEnvironmentKey"
        Effect   = "Allow"
        Action   = "kms:Decrypt"
        Resource = var.kms_key_arn
      },
    ]
  })
}

resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  namespace        = "external-secrets"
  create_namespace = true
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "2.11.0"
  values = [yamlencode({
    installCRDs = true
    serviceAccount = {
      name        = "external-secrets"
      annotations = { "eks.amazonaws.com/role-arn" = module.external_secrets_role.arn }
    }
  })]
}

resource "helm_release" "secret_store" {
  name      = "secret-store"
  namespace = "external-secrets"
  chart     = "${path.module}/charts/secret-store"
  values = [yamlencode({
    name   = "aws-secrets-manager"
    region = local.region
  })]
  depends_on = [helm_release.external_secrets]
}

# ── ExternalDNS ───────────────────────────────────────────────────────────────

module "external_dns_role" {
  source            = "../irsa-role"
  name              = "${var.name}-external-dns"
  oidc_provider_arn = var.oidc_provider_arn
  oidc_issuer       = var.oidc_issuer
  namespace         = "kube-system"
  service_account   = "external-dns"
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets"]
        Resource = "${local.arn}:route53:::hostedzone/${var.zone_id}"
      },
      {
        Effect   = "Allow"
        Action   = ["route53:ListHostedZones", "route53:ListResourceRecordSets", "route53:ListTagsForResources"]
        Resource = "*"
      },
    ]
  })
}

resource "helm_release" "external_dns" {
  name       = "external-dns"
  namespace  = "kube-system"
  repository = "https://kubernetes-sigs.github.io/external-dns"
  chart      = "external-dns"
  version    = "1.23.0"
  values = [yamlencode({
    provider      = { name = "aws" }
    sources       = ["ingress"]
    domainFilters = [var.domain]
    # Only records it created (TXT ownership); never deletes the zone's other records.
    policy     = "upsert-only"
    txtOwnerId = var.name
    serviceAccount = {
      name        = "external-dns"
      annotations = { "eks.amazonaws.com/role-arn" = module.external_dns_role.arn }
    }
  })]
}

# ── metrics-server ────────────────────────────────────────────────────────────

resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  namespace  = "kube-system"
  repository = "https://kubernetes-sigs.github.io/metrics-server"
  chart      = "metrics-server"
  version    = "3.14.0"
  values     = [yamlencode({ replicas = 2 })]
}
