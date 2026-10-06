output "bootstrap_brokers_sasl_scram" {
  value = aws_msk_cluster.this.bootstrap_brokers_sasl_scram
}

output "user_secret_names" {
  value = { for user, secret in aws_secretsmanager_secret.user : user => secret.name }
}

output "user_secret_arns" {
  value = [for secret in aws_secretsmanager_secret.user : secret.arn]
}

output "user_secret_arns_by_user" {
  value = { for user, secret in aws_secretsmanager_secret.user : user => secret.arn }
}
