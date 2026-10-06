variable "environment" {
  type = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "staging or production."
  }
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "vpc_cidr" {
  type = string
}

variable "domain" {
  description = "Registered domain with a Route 53 hosted zone, e.g. csekeyboards.com."
  type        = string
}

variable "web_host" {
  description = "Storefront host, e.g. www.csekeyboards.com"
  type        = string
}

variable "api_host" {
  type = string
}

variable "cdn_host" {
  type = string
}

variable "github_repository" {
  description = "owner/name, for the deploy role's OIDC trust."
  type        = string
}

variable "cluster_admin_role_arns" {
  description = "IAM roles (SSO permission sets) with cluster-admin access."
  type        = list(string)
}

variable "eks_public_access_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "sizing" {
  description = "Instance sizes and redundancy of this environment."
  type = object({
    single_nat_gateway  = bool
    node_instance_types = list(string)
    node_min            = number
    node_max            = number
    db_instance_class   = string
    db_multi_az         = bool
    db_storage_gb       = number
    db_backup_days      = number
    redis_node_type     = string
    redis_replicas      = number
    kafka_broker_type   = string
  })
}

variable "dmarc_report_address" {
  type = string
}

variable "credential_versions" {
  description = "Increase a number to rotate the generated credentials it names (new value written to Secrets Manager)."
  type = object({
    redis = optional(number, 1)
    kafka = optional(number, 1)
  })
  default = {}
}

variable "alert_email" {
  description = "Receives alert notifications by email (confirm the SNS subscription). Empty: none."
  type        = string
  default     = ""
}

variable "grafana" {
  description = "Amazon Managed Grafana (needs IAM Identity Center); admin_group_ids are Identity Center groups."
  type = object({
    enabled         = bool
    admin_group_ids = optional(list(string), [])
    version         = optional(string, "10.4")
  })
  default = { enabled = false }
}
