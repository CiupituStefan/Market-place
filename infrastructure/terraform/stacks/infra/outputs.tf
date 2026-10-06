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

# The account-specific values of the Helm chart (infrastructure/helm/README.md). No secrets.
# The deploy pipeline reads them from SSM (local.helm_values_parameter), not from state.
output "helm_values" {
  value = local.helm_values
}

output "helm_values_parameter" {
  value = aws_ssm_parameter.helm_values.name
}

output "deployers_group" {
  value = local.deployers_group
}
