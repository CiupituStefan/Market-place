output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_ca" {
  value = module.eks.cluster_ca
}

output "oidc_provider_arn" {
  value = module.eks.oidc_provider_arn
}

output "oidc_issuer" {
  value = module.eks.oidc_issuer
}

output "vpc_id" {
  value = module.network.vpc_id
}

output "kms_key_arn" {
  value = aws_kms_key.this.arn
}

output "zone_id" {
  value = data.aws_route53_zone.this.zone_id
}

output "app_namespace" {
  value = local.app_namespace
}

output "secret_name_prefixes" {
  description = "What External Secrets may read in this environment."
  value       = ["${local.secret_prefix}/", "AmazonMSK_${local.name}_"]
}

output "deploy_role_arn" {
  value = module.github.role_arns["${local.name}-deploy"]
}

output "database_endpoint" {
  value = module.postgres.endpoint
}

output "database_master_secret_arn" {
  value = module.postgres.master_user_secret_arn
}

# The account-specific values of the Helm chart (infrastructure/helm/README.md), consumed
# by the deploy pipeline as an extra values file. Contains no secrets.
output "helm_values" {
  value = yamlencode({
    global = {
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
