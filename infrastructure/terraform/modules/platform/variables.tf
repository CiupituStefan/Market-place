variable "name" {
  description = "Environment name prefix, e.g. cse-production."
  type        = string
}

variable "cluster_name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "oidc_provider_arn" {
  type = string
}

variable "oidc_issuer" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "secret_name_prefixes" {
  description = "Secrets Manager name prefixes External Secrets may read (this environment only)."
  type        = list(string)
}

variable "zone_id" {
  type = string
}

variable "domain" {
  type = string
}

variable "app_namespace" {
  type = string
}
