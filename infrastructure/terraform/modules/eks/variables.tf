variable "name" {
  type = string
}

variable "kubernetes_version" {
  type    = string
  default = "1.33"
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "public_access_cidrs" {
  description = "CIDRs allowed to reach the public API endpoint (IAM authentication still applies)."
  type        = list(string)
}

variable "kms_key_arn" {
  type = string
}

variable "node_instance_types" {
  type    = list(string)
  default = ["m7i.large"]
}

variable "node_capacity_type" {
  type    = string
  default = "ON_DEMAND"
  validation {
    condition     = contains(["ON_DEMAND", "SPOT"], var.node_capacity_type)
    error_message = "ON_DEMAND or SPOT."
  }
}

variable "node_min_size" {
  type    = number
  default = 3
}

variable "node_max_size" {
  type    = number
  default = 10
}

variable "access" {
  description = <<-EOT
    IAM roles allowed into the cluster: an EKS access policy (optionally limited to namespaces)
    and/or Kubernetes groups whose permissions come from RBAC objects (e.g. a namespaced Role).
  EOT
  type = map(object({
    principal_arn     = string
    policy            = optional(string)
    namespaces        = optional(list(string), [])
    kubernetes_groups = optional(list(string), [])
  }))
  default = {}
}
