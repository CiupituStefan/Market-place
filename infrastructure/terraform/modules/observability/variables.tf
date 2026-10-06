variable "name" {
  description = "Environment prefix, e.g. cse-staging."
  type        = string
}

variable "region" {
  type = string
}

variable "kms_key_arn" {
  description = "Encrypts metrics, logs and the alert topic."
  type        = string
}

variable "alert_rules" {
  description = "Prometheus alert rules (YAML), the same file Prometheus uses locally."
  type        = string
}

variable "alert_email" {
  description = "Receives alert notifications (SNS email; confirm the subscription). Empty: no subscription."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "grafana" {
  description = <<-EOT
    Amazon Managed Grafana, signed in through IAM Identity Center (must be enabled in the
    account). admin_group_ids: Identity Center groups given the Grafana Admin role.
  EOT
  type = object({
    enabled         = bool
    admin_group_ids = optional(list(string), [])
    # A version Amazon Managed Grafana offers; the dashboards use schema 39 (10.4) or older.
    version = optional(string, "10.4")
  })
  default = { enabled = false }
}
