output "prometheus_workspace_arn" {
  value = aws_prometheus_workspace.this.arn
}

output "prometheus_endpoint" {
  description = "Base URL; remote write at <endpoint>api/v1/remote_write, queries at <endpoint>api/v1/query."
  value       = aws_prometheus_workspace.this.prometheus_endpoint
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.application.name
}

output "log_group_arn" {
  value = aws_cloudwatch_log_group.application.arn
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "grafana_endpoint" {
  value = var.grafana.enabled ? "https://${aws_grafana_workspace.this[0].endpoint}" : null
}

output "grafana_workspace_id" {
  value = var.grafana.enabled ? aws_grafana_workspace.this[0].id : null
}

output "grafana_workspace_arn" {
  value = var.grafana.enabled ? aws_grafana_workspace.this[0].arn : null
}

output "grafana_sync_service_account_id" {
  value = var.grafana.enabled ? aws_grafana_workspace_service_account.sync[0].service_account_id : null
}
