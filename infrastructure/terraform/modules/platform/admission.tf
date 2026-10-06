# Admission control (ADR-024): in the application namespace, a pod is admitted only when every
# image comes from our ECR registry by commit SHA (or digest) and carries SLSA provenance
# signed (Sigstore keyless, public transparency log) by this repository's build workflow on main.
# The deploy pipeline checks the same before rolling out; this is what stops anything that
# skips the pipeline: kubectl with stolen deployer credentials, a tampered chart, a pod rescheduled
# onto an image someone overwrote.
#
# Kyverno policies are fail-closed (failurePolicy Fail) and scoped to the application namespace
# only, so a Kyverno outage cannot block system pods: it blocks new application pods, while the
# running ones keep serving. Kyverno itself runs three admission replicas.

module "kyverno_role" {
  source            = "../irsa-role"
  name              = "${var.name}-kyverno"
  oidc_provider_arn = var.oidc_provider_arn
  oidc_issuer       = var.oidc_issuer
  namespace         = "kyverno"
  service_account   = "kyverno-admission-controller"
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "RegistryToken"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        # Read-only: manifests and the attestation bundles stored next to each image.
        Sid    = "ReadOurImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability",
          "ecr:DescribeImages",
          "ecr:ListImages",
        ]
        Resource = "${local.arn}:ecr:${local.region}:${local.account}:repository/cse/*"
      },
    ]
  })
}

resource "helm_release" "kyverno" {
  name             = "kyverno"
  namespace        = "kyverno"
  create_namespace = true
  repository       = "https://kyverno.github.io/kyverno"
  chart            = "kyverno"
  version          = "3.9.1"
  values = [yamlencode({
    # The chart's webhooks already skip kube-system, and Kyverno skips its own namespace.
    admissionController = {
      replicas = 3
      rbac = {
        serviceAccount = {
          name        = "kyverno-admission-controller"
          annotations = { "eks.amazonaws.com/role-arn" = module.kyverno_role.arn }
        }
      }
    }
  })]
}

resource "helm_release" "admission_policies" {
  name      = "admission-policies"
  namespace = "kyverno"
  chart     = "${path.module}/charts/admission-policies"
  values = [yamlencode({
    namespaces       = [kubernetes_namespace_v1.app.metadata[0].name]
    registry         = var.admission.registry
    githubRepository = var.admission.github_repository
  })]
  depends_on = [helm_release.kyverno]
}
