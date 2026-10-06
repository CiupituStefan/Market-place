# ── OpenTelemetry collector ───────────────────────────────────────────────────
# Receives OTLP from every service (Helm value global.telemetry.endpoint) and writes metrics to
# Amazon Managed Prometheus, traces to AWS X-Ray and logs to CloudWatch Logs. Query strings
# are redacted from spans before export (same rules as locally).

resource "kubernetes_namespace_v1" "observability" {
  metadata {
    name = "observability"
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted"
      "pod-security.kubernetes.io/audit"   = "restricted"
      "pod-security.kubernetes.io/warn"    = "restricted"
    }
  }
}

module "otel_collector_role" {
  source            = "../irsa-role"
  name              = "${var.name}-otel-collector"
  oidc_provider_arn = var.oidc_provider_arn
  oidc_issuer       = var.oidc_issuer
  namespace         = kubernetes_namespace_v1.observability.metadata[0].name
  service_account   = "otel-collector"
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WriteMetrics"
        Effect   = "Allow"
        Action   = "aps:RemoteWrite"
        Resource = var.observability.prometheus_workspace_arn
      },
      {
        # X-Ray has no resource-level permissions for writes.
        Sid      = "WriteTraces"
        Effect   = "Allow"
        Action   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
        Resource = "*"
      },
      {
        Sid      = "WriteLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
        Resource = "${var.observability.log_group_arn}:*"
      },
    ]
  })
}

locals {
  redaction = yamldecode(file("${path.module}/../../../observability/otel-collector/redaction.yaml"))

  otel_collector_config = {
    extensions = {
      # Required by the chart's probes.
      health_check = { endpoint = "$${env:MY_POD_IP}:13133" }
      sigv4auth    = { region = local.region, service = "aps" }
    }
    receivers = {
      otlp = {
        protocols = {
          grpc = { endpoint = "$${env:MY_POD_IP}:4317" }
          http = { endpoint = "$${env:MY_POD_IP}:4318" }
        }
      }
    }
    processors = merge(local.redaction.processors, {
      memory_limiter = { check_interval = "1s", limit_percentage = 80, spike_limit_percentage = 25 }
      batch          = {}
    })
    exporters = {
      prometheusremotewrite = {
        endpoint = "${var.observability.prometheus_endpoint}api/v1/remote_write"
        auth     = { authenticator = "sigv4auth" }
      }
      awsxray = {
        region = local.region
        # Searchable in X-Ray: annotation.request_id = "<x-request-id>".
        indexed_attributes = ["request.id", "cse.event.type"]
      }
      awscloudwatchlogs = {
        region          = local.region
        log_group_name  = var.observability.log_group_name
        log_stream_name = "otel-$${env:OTEL_K8S_POD_NAME}"
      }
    }
    service = {
      extensions = ["health_check", "sigv4auth"]
      pipelines = {
        traces  = { receivers = ["otlp"], processors = ["memory_limiter", "transform/redact", "batch"], exporters = ["awsxray"] }
        metrics = { receivers = ["otlp"], processors = ["memory_limiter", "batch"], exporters = ["prometheusremotewrite"] }
        logs    = { receivers = ["otlp"], processors = ["memory_limiter", "batch"], exporters = ["awscloudwatchlogs"] }
      }
    }
  }
}

resource "helm_release" "otel_collector" {
  name       = "otel-collector"
  namespace  = kubernetes_namespace_v1.observability.metadata[0].name
  repository = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart      = "opentelemetry-collector"
  version    = "0.175.1"
  values = [yamlencode({
    mode             = "deployment"
    fullnameOverride = "otel-collector"
    replicaCount     = 2
    image = {
      repository = "ghcr.io/open-telemetry/opentelemetry-collector-releases/opentelemetry-collector-contrib"
      tag        = "0.162.0"
      digest     = "sha256:39923a8e431bd1f57be82411999d389fcfe40857492e4365456d97a4c1f74be6"
    }
    command = { name = "otelcol-contrib" }
    # The whole configuration (not merged with the chart's defaults: no Jaeger/Zipkin).
    alternateConfig = local.otel_collector_config
    serviceAccount = {
      name        = "otel-collector"
      annotations = { "eks.amazonaws.com/role-arn" = module.otel_collector_role.arn }
    }
    ports = {
      otlp           = { enabled = true, hostPort = null }
      otlp-http      = { enabled = true, hostPort = null }
      jaeger-compact = { enabled = false }
      jaeger-thrift  = { enabled = false }
      jaeger-grpc    = { enabled = false }
      zipkin         = { enabled = false }
      metrics        = { enabled = false }
    }
    useGOMEMLIMIT = true
    resources = {
      requests = { cpu = "100m", memory = "256Mi" }
      limits   = { memory = "512Mi" }
    }
    podSecurityContext = {
      runAsNonRoot   = true
      seccompProfile = { type = "RuntimeDefault" }
    }
    securityContext = {
      allowPrivilegeEscalation = false
      readOnlyRootFilesystem   = true
      capabilities             = { drop = ["ALL"] }
    }
    podDisruptionBudget = { enabled = true, minAvailable = 1 }
  })]
}
