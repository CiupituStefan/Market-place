# Kafka topics and per-service ACLs (ADR-024), from infrastructure/kafka/ (generated from
# packages/events/src/access.ts). MSK is reachable only from inside the VPC, so they are applied
# by a Job in the cluster, as the kafka-admin SCRAM user, whenever those files change.
#
# The admin credentials are readable by one IAM role only (this job's SecretStore); the shared
# External Secrets role is explicitly denied them (main.tf), so no application namespace can
# pull them in through an ExternalSecret.

locals {
  kafka_access_dir = "${path.module}/../../../kafka"
  kafka_access_files = {
    "apply.sh"   = file("${local.kafka_access_dir}/apply.sh")
    "acls.txt"   = file("${local.kafka_access_dir}/acls.txt")
    "topics.txt" = file("${local.kafka_access_dir}/topics.txt")
  }
}

resource "kubernetes_namespace_v1" "kafka_access" {
  metadata {
    name = "kafka-access"
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted"
      "pod-security.kubernetes.io/audit"   = "restricted"
      "pod-security.kubernetes.io/warn"    = "restricted"
    }
  }
}

module "kafka_access_role" {
  source            = "../irsa-role"
  name              = "${var.name}-kafka-access"
  oidc_provider_arn = var.oidc_provider_arn
  oidc_issuer       = var.oidc_issuer
  namespace         = kubernetes_namespace_v1.kafka_access.metadata[0].name
  service_account   = "kafka-access"
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadTheKafkaAdminSecret"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = var.kafka.admin_secret_arn
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

resource "helm_release" "kafka_access" {
  name          = "kafka-access"
  namespace     = kubernetes_namespace_v1.kafka_access.metadata[0].name
  chart         = "${path.module}/charts/kafka-access"
  wait_for_jobs = true
  timeout       = 900
  values = [yamlencode({
    region           = local.region
    roleArn          = module.kafka_access_role.arn
    adminSecretName  = var.kafka.admin_secret_name
    bootstrapBrokers = var.kafka.bootstrap_brokers
    dataCidrs        = var.kafka.data_cidrs
    revision         = sha256(jsonencode(local.kafka_access_files))
    files            = local.kafka_access_files
  })]
  depends_on = [helm_release.secret_store]
}
