# Observability backends, managed: Amazon Managed Service for Prometheus (metrics, alert
# rules, Alertmanager → SNS), CloudWatch Logs (application logs), AWS X-Ray (traces, no
# resource needed) and, optionally, Amazon Managed Grafana. The OpenTelemetry collector in the
# cluster (platform stack) writes to them.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account = data.aws_caller_identity.current.account_id
}

# ── metrics ──────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "prometheus" {
  name              = "/aws/prometheus/${var.name}"
  retention_in_days = 365
  kms_key_id        = var.kms_key_arn
}

resource "aws_prometheus_workspace" "this" {
  alias       = var.name
  kms_key_arn = var.kms_key_arn
  # Rule evaluation and Alertmanager errors (e.g. a rule that stopped matching).
  logging_configuration {
    log_group_arn = "${aws_cloudwatch_log_group.prometheus.arn}:*"
  }
}

resource "aws_prometheus_rule_group_namespace" "alerts" {
  name         = "cse"
  workspace_id = aws_prometheus_workspace.this.id
  data         = var.alert_rules
}

# ── alerts ───────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name              = "${var.name}-alerts"
  kms_master_key_id = var.kms_key_arn
}

data "aws_iam_policy_document" "alerts" {
  statement {
    sid       = "PrometheusAlertmanagerPublishes"
    actions   = ["sns:Publish", "sns:GetTopicAttributes"]
    resources = [aws_sns_topic.alerts.arn]
    principals {
      type        = "Service"
      identifiers = ["aps.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_prometheus_workspace.this.arn]
    }
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.alerts.json
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_prometheus_alert_manager_definition" "this" {
  workspace_id = aws_prometheus_workspace.this.id
  definition   = <<-EOT
    alertmanager_config: |
      route:
        receiver: sns
        group_by: [alertname, job]
        group_wait: 30s
        group_interval: 5m
        repeat_interval: 4h
      receivers:
        - name: sns
          sns_configs:
            - topic_arn: ${aws_sns_topic.alerts.arn}
              sigv4:
                region: ${var.region}
              subject: '[${var.name}] {{ .CommonLabels.alertname }} ({{ .CommonLabels.severity }})'
  EOT
  depends_on   = [aws_sns_topic_policy.alerts]
}

# ── logs ─────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "application" {
  #checkov:skip=CKV_AWS_338:Application logs: 30 days by default (90 in production); audit trails live elsewhere.
  name              = "/cse/${var.name}/application"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
}

# ── Grafana (optional) ───────────────────────────────────────────────────────

data "aws_iam_policy_document" "grafana_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["grafana.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account]
    }
  }
}

resource "aws_iam_role" "grafana" {
  count              = var.grafana.enabled ? 1 : 0
  name               = "${var.name}-grafana"
  assume_role_policy = data.aws_iam_policy_document.grafana_trust.json
}

data "aws_iam_policy_document" "grafana" {
  #checkov:skip=CKV_AWS_356:Read-only listing and X-Ray trace reads have no resource-level permissions; everything else is scoped.
  statement {
    sid = "QueryMetrics"
    actions = [
      "aps:QueryMetrics", "aps:GetSeries", "aps:GetLabels", "aps:GetMetricMetadata",
      "aps:DescribeWorkspace",
    ]
    resources = [aws_prometheus_workspace.this.arn]
  }
  statement {
    sid       = "ListWorkspaces"
    actions   = ["aps:ListWorkspaces"]
    resources = ["*"]
  }
  statement {
    sid = "ReadTraces"
    actions = [
      "xray:BatchGetTraces", "xray:GetTraceSummaries", "xray:GetTraceGraph", "xray:GetGroups",
      "xray:GetGroup", "xray:GetTimeSeriesServiceStatistics", "xray:GetInsightSummaries",
      "xray:GetInsight", "xray:GetServiceGraph", "xray:GetSamplingRules",
    ]
    resources = ["*"]
  }
  statement {
    sid = "ReadLogs"
    actions = [
      "logs:StartQuery", "logs:StopQuery", "logs:GetQueryResults", "logs:GetLogEvents",
      "logs:FilterLogEvents", "logs:DescribeLogStreams",
    ]
    resources = ["${aws_cloudwatch_log_group.application.arn}:*"]
  }
  statement {
    sid       = "DiscoverLogs"
    actions   = ["logs:DescribeLogGroups", "logs:GetLogGroupFields", "logs:DescribeQueries"]
    resources = ["*"]
  }
  statement {
    sid       = "DecryptLogs"
    actions   = ["kms:Decrypt"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_role_policy" "grafana" {
  count  = var.grafana.enabled ? 1 : 0
  name   = "read-observability-data"
  role   = aws_iam_role.grafana[0].id
  policy = data.aws_iam_policy_document.grafana.json
}

resource "aws_grafana_workspace" "this" {
  count                    = var.grafana.enabled ? 1 : 0
  name                     = var.name
  description              = "CSE Keyboards ${var.name}: metrics (AMP), traces (X-Ray), logs (CloudWatch)"
  account_access_type      = "CURRENT_ACCOUNT"
  authentication_providers = ["AWS_SSO"]
  permission_type          = "CUSTOMER_MANAGED"
  role_arn                 = aws_iam_role.grafana[0].arn
  data_sources             = ["PROMETHEUS", "XRAY", "CLOUDWATCH"]
  grafana_version          = var.grafana.version
}

resource "aws_grafana_role_association" "admins" {
  count        = var.grafana.enabled && length(var.grafana.admin_group_ids) > 0 ? 1 : 0
  role         = "ADMIN"
  group_ids    = var.grafana.admin_group_ids
  workspace_id = aws_grafana_workspace.this[0].id
}

# Dashboards are synced from the repository by the deploy pipeline (scripts/grafana-sync.sh)
# with short-lived tokens of this service account; no long-lived token exists.
resource "aws_grafana_workspace_service_account" "sync" {
  count        = var.grafana.enabled ? 1 : 0
  name         = "dashboard-sync"
  grafana_role = "ADMIN"
  workspace_id = aws_grafana_workspace.this[0].id
}
