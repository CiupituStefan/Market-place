output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "cluster_ca" {
  value = aws_eks_cluster.this.certificate_authority[0].data
}

# EKS attaches this security group to managed nodes: data stores admit it.
output "cluster_security_group_id" {
  value = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.this.arn
}

output "oidc_issuer" {
  value = replace(aws_eks_cluster.this.identity[0].oidc[0].issuer, "https://", "")
}

output "access_entry_groups" {
  description = "Kubernetes groups per access entry."
  value       = { for k, e in aws_eks_access_entry.this : k => toset(coalesce(e.kubernetes_groups, [])) }
}

output "access_policies" {
  description = "EKS access policy per access entry that has one."
  value       = { for k, a in aws_eks_access_policy_association.this : k => a.policy_arn }
}
