locals {
  name          = "cse-${var.environment}"
  app_namespace = "cse-${var.environment}"
  secret_prefix = "cse/${var.environment}"
  # Kubernetes group of the CI deploy role; bound to a namespaced Role by the platform stack.
  deployers_group = "cse-deployers"
  # Helm values for the deploy pipeline (no secrets): read by the deploy role, not from state.
  helm_values_parameter = "/cse/${var.environment}/helm-values"
  grafana_parameter     = "/cse/${var.environment}/grafana"
  registry              = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com"
  # Every deployable unit; services are also Kafka users and have a secrets entry.
  services = [
    "api-gateway", "auth-service", "product-service", "inventory-service", "cart-service",
    "order-service", "payment-service", "notification-service", "review-service", "admin-service",
  ]
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

data "aws_route53_zone" "this" {
  name = var.domain
}

# ── encryption key for this environment ───────────────────────────────────────

data "aws_iam_policy_document" "kms" {
  #checkov:skip=CKV_AWS_109:Standard key policy: the account root delegates to IAM policies.
  #checkov:skip=CKV_AWS_111:Standard key policy: the account root delegates to IAM policies.
  #checkov:skip=CKV_AWS_356:In a key policy "*" means this key.
  statement {
    sid       = "AccountAdministration"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
  # Amazon Managed Prometheus publishes alerts to the encrypted SNS topic.
  statement {
    sid       = "PrometheusAlertsToEncryptedTopic"
    actions   = ["kms:GenerateDataKey*", "kms:Decrypt"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["aps.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
  # CloudWatch Logs encrypts the cluster, flow, MSK and WAF log groups with this key.
  statement {
    sid       = "CloudWatchLogs"
    actions   = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_kms_key" "this" {
  description             = "${local.name}: secrets, databases, logs"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.kms.json
}

resource "aws_kms_alias" "this" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.this.key_id
}

# ── network and cluster ───────────────────────────────────────────────────────

module "network" {
  source             = "../../modules/network"
  name               = local.name
  region             = var.region
  cidr               = var.vpc_cidr
  single_nat_gateway = var.sizing.single_nat_gateway
  log_kms_key_arn    = aws_kms_key.this.arn
}

module "eks" {
  source              = "../../modules/eks"
  name                = local.name
  private_subnet_ids  = module.network.private_subnet_ids
  public_access_cidrs = var.eks_public_access_cidrs
  kms_key_arn         = aws_kms_key.this.arn
  node_instance_types = var.sizing.node_instance_types
  node_min_size       = var.sizing.node_min
  node_max_size       = var.sizing.node_max
  access = merge(
    { for i, arn in var.cluster_admin_role_arns : "admin-${i}" => {
      principal_arn = arn
      policy        = "AmazonEKSClusterAdminPolicy"
    } },
    {
      # CI deploys the application chart: permissions from a Role in the app namespace
      # (platform stack), limited to the kinds the chart renders and with no access to Secrets.
      deploy = {
        principal_arn     = module.github.role_arns["${local.name}-deploy"]
        kubernetes_groups = [local.deployers_group]
      }
    },
  )
}

# ── data stores ───────────────────────────────────────────────────────────────

module "postgres" {
  source                   = "../../modules/postgres"
  name                     = local.name
  vpc_id                   = module.network.vpc_id
  subnet_ids               = module.network.data_subnet_ids
  client_security_group_id = module.eks.cluster_security_group_id
  kms_key_arn              = aws_kms_key.this.arn
  instance_class           = var.sizing.db_instance_class
  multi_az                 = var.sizing.db_multi_az
  allocated_storage        = var.sizing.db_storage_gb
  backup_retention_days    = var.sizing.db_backup_days
  deletion_protection      = var.environment == "production"
}

module "redis" {
  source                   = "../../modules/redis"
  name                     = local.name
  vpc_id                   = module.network.vpc_id
  subnet_ids               = module.network.data_subnet_ids
  client_security_group_id = module.eks.cluster_security_group_id
  kms_key_arn              = aws_kms_key.this.arn
  node_type                = var.sizing.redis_node_type
  replicas                 = var.sizing.redis_replicas
  secret_name              = "${local.secret_prefix}/redis"
  auth_token_version       = var.credential_versions.redis
}

module "msk" {
  source                   = "../../modules/msk"
  name                     = local.name
  vpc_id                   = module.network.vpc_id
  subnet_ids               = module.network.data_subnet_ids
  client_security_group_id = module.eks.cluster_security_group_id
  kms_key_arn              = aws_kms_key.this.arn
  broker_instance_type     = var.sizing.kafka_broker_type
  users                    = local.services
  credentials_version      = var.credential_versions.kafka
}

module "secrets" {
  source      = "../../modules/secrets"
  prefix      = local.secret_prefix
  components  = local.services
  kms_key_arn = aws_kms_key.this.arn
}

# ── edge: certificate, WAF, product images ────────────────────────────────────

resource "aws_acm_certificate" "app" {
  domain_name               = var.web_host
  subject_alternative_names = [var.api_host]
  validation_method         = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "app_validation" {
  for_each = {
    for o in aws_acm_certificate.app.domain_validation_options : o.domain_name => o
  }
  zone_id         = data.aws_route53_zone.this.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.app_validation : r.fqdn]
}

module "waf" {
  source      = "../../modules/waf"
  name        = local.name
  kms_key_arn = aws_kms_key.this.arn
}

module "assets" {
  source         = "../../modules/assets"
  providers      = { aws = aws, aws.us_east_1 = aws.us_east_1 }
  bucket_name    = "${local.name}-product-images-${data.aws_caller_identity.current.account_id}"
  cdn_domain     = var.cdn_host
  zone_id        = data.aws_route53_zone.this.zone_id
  upload_origins = [var.web_host]
}

module "ses" {
  source               = "../../modules/ses"
  domain               = var.environment == "production" ? var.domain : "${var.environment}.${var.domain}"
  zone_id              = data.aws_route53_zone.this.zone_id
  configuration_set    = local.name
  dmarc_report_address = var.dmarc_report_address
}

# ── workload identities (IRSA) ────────────────────────────────────────────────

module "product_service_role" {
  source            = "../../modules/irsa-role"
  name              = "${local.name}-product-service"
  oidc_provider_arn = module.eks.oidc_provider_arn
  oidc_issuer       = module.eks.oidc_issuer
  namespace         = local.app_namespace
  service_account   = "product-service"
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ProductImages"
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
      Resource = "${module.assets.bucket_arn}/products/*"
    }]
  })
}

module "notification_service_role" {
  source            = "../../modules/irsa-role"
  name              = "${local.name}-notification-service"
  oidc_provider_arn = module.eks.oidc_provider_arn
  oidc_issuer       = module.eks.oidc_issuer
  namespace         = local.app_namespace
  service_account   = "notification-service"
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "SendFromTheShopDomain"
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = [module.ses.identity_arn, "arn:${data.aws_partition.current.partition}:ses:${var.region}:${data.aws_caller_identity.current.account_id}:configuration-set/${module.ses.configuration_set}"]
    }]
  })
}

# ── CI/CD identity for this environment ───────────────────────────────────────

module "github" {
  source          = "../../modules/github-oidc"
  repository      = var.github_repository
  create_provider = false # created once per account by the global stack
  roles = {
    "${local.name}-deploy" = {
      # Only workflow jobs bound to the matching GitHub environment (approval rules live there).
      subjects = ["environment:${var.environment}"]
      policy_json = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Sid      = "FindTheCluster"
            Effect   = "Allow"
            Action   = ["eks:DescribeCluster"]
            Resource = "arn:${data.aws_partition.current.partition}:eks:${var.region}:${data.aws_caller_identity.current.account_id}:cluster/${local.name}"
          },
          {
            Sid      = "ReadTheHelmValues"
            Effect   = "Allow"
            Action   = ["ssm:GetParameter"]
            Resource = "arn:${data.aws_partition.current.partition}:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.helm_values_parameter}"
          },
          {
            # Refuse to deploy a commit whose images are missing or lack verified provenance:
            # read image metadata and manifests (digests); never push.
            Sid      = "InspectTheImages"
            Effect   = "Allow"
            Action   = ["ecr:DescribeImages", "ecr:BatchGetImage"]
            Resource = "arn:${data.aws_partition.current.partition}:ecr:${var.region}:${data.aws_caller_identity.current.account_id}:repository/cse/*"
          },
          {
            Sid      = "ReadTheGrafanaSettings"
            Effect   = "Allow"
            Action   = ["ssm:GetParameter"]
            Resource = "arn:${data.aws_partition.current.partition}:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.grafana_parameter}"
          },
          {
            Sid      = "RegistryLogin"
            Effect   = "Allow"
            Action   = ["ecr:GetAuthorizationToken"]
            Resource = "*"
          },
          {
            # The repositories are encrypted with the global stack's key; only through ECR.
            Sid      = "ReadEncryptedManifests"
            Effect   = "Allow"
            Action   = ["kms:Decrypt"]
            Resource = "arn:${data.aws_partition.current.partition}:kms:${var.region}:${data.aws_caller_identity.current.account_id}:key/*"
            Condition = {
              StringEquals = { "kms:ViaService" = "ecr.${var.region}.amazonaws.com" }
            }
          },
        ]
      })
    }
  }
}

# ── deploy pipeline inputs ────────────────────────────────────────────────────

locals {
  helm_values = yamlencode({
    global = {
      image = { registry = local.registry }
      externalSecrets = {
        keyPrefix         = local.secret_prefix
        kafkaSecretPrefix = "AmazonMSK_${local.name}_"
        redisSecretKey    = module.redis.secret_name
      }
      ingress = {
        certificateArn    = aws_acm_certificate_validation.app.certificate_arn
        wafAclArn         = module.waf.web_acl_arn
        loadBalancerCidrs = [module.network.vpc_cidr]
      }
      env = {
        KAFKA_BROKERS = module.msk.bootstrap_brokers_sasl_scram
      }
    }
    components = {
      product-service = {
        iamRoleArn = module.product_service_role.arn
        env = {
          S3_BUCKET      = module.assets.bucket_name
          S3_REGION      = var.region
          ASSET_BASE_URL = module.assets.cdn_url
        }
      }
      notification-service = {
        iamRoleArn = module.notification_service_role.arn
        env = {
          SES_REGION            = var.region
          SES_CONFIGURATION_SET = module.ses.configuration_set
          EMAIL_FROM            = "CSE Keyboards <hello@${var.environment == "production" ? var.domain : "${var.environment}.${var.domain}"}>"
        }
      }
    }
  })
}

resource "aws_ssm_parameter" "helm_values" {
  #checkov:skip=CKV2_AWS_34:Not a secret (resource names, ARNs, hosts); readable by the deploy role.
  name        = local.helm_values_parameter
  description = "Account-specific Helm values for ${local.name} (no secrets)"
  type        = "String"
  # Standard tier while the YAML fits in 4 KB; moves to advanced on its own if it grows.
  tier  = "Intelligent-Tiering"
  value = local.helm_values
}

# ── observability ─────────────────────────────────────────────────────────────

module "observability" {
  source             = "../../modules/observability"
  name               = local.name
  region             = var.region
  kms_key_arn        = aws_kms_key.this.arn
  alert_rules        = file("${path.module}/../../../observability/prometheus/alerts.yml")
  alert_email        = var.alert_email
  log_retention_days = var.environment == "production" ? 90 : 30
  grafana            = var.grafana
}

# The deploy pipeline syncs dashboards into Amazon Managed Grafana with 15-minute tokens.
resource "aws_ssm_parameter" "grafana" {
  #checkov:skip=CKV2_AWS_34:Not a secret (workspace and service account IDs, endpoints).
  count       = var.grafana.enabled ? 1 : 0
  name        = local.grafana_parameter
  description = "Amazon Managed Grafana workspace for ${local.name} dashboards (no secrets)"
  type        = "String"
  value = jsonencode({
    workspaceId        = module.observability.grafana_workspace_id
    serviceAccountId   = module.observability.grafana_sync_service_account_id
    url                = module.observability.grafana_endpoint
    prometheusEndpoint = module.observability.prometheus_endpoint
  })
}

resource "aws_iam_role_policy" "deploy_grafana" {
  count = var.grafana.enabled ? 1 : 0
  name  = "sync-dashboards"
  # Role name from its ARN (arn:aws:iam::<account>:role/<name>).
  role = element(split("/", module.github.role_arns["${local.name}-deploy"]), 1)
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ShortLivedDashboardTokens"
      Effect   = "Allow"
      Action   = ["grafana:CreateWorkspaceServiceAccountToken", "grafana:DeleteWorkspaceServiceAccountToken"]
      Resource = module.observability.grafana_workspace_arn
    }]
  })
}
