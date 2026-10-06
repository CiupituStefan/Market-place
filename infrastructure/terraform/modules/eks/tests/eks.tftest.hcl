mock_provider "aws" {
  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
}

mock_provider "tls" {}

variables {
  name                = "cse-test"
  private_subnet_ids  = ["subnet-a", "subnet-b", "subnet-c"]
  public_access_cidrs = ["203.0.113.0/24"]
  kms_key_arn         = "arn:aws:kms:eu-central-1:123456789012:key/mock"
}

run "hardened_control_plane_and_nodes" {
  command = plan

  assert {
    condition     = aws_eks_cluster.this.access_config[0].authentication_mode == "API" && !aws_eks_cluster.this.access_config[0].bootstrap_cluster_creator_admin_permissions
    error_message = "Access entries only; the creator gets no implicit admin."
  }
  assert {
    condition     = aws_eks_cluster.this.encryption_config[0].resources == toset(["secrets"])
    error_message = "Kubernetes secrets are envelope-encrypted with KMS."
  }
  assert {
    condition     = contains(aws_eks_cluster.this.enabled_cluster_log_types, "audit")
    error_message = "Audit logs are on."
  }
  assert {
    condition     = aws_launch_template.node.metadata_options[0].http_tokens == "required" && aws_launch_template.node.metadata_options[0].http_put_response_hop_limit == 1
    error_message = "IMDSv2 with one hop: pods cannot read node credentials."
  }
  assert {
    condition     = jsondecode(aws_eks_addon.vpc_cni.configuration_values).enableNetworkPolicy == "true"
    error_message = "Network policies are enforced."
  }
}
