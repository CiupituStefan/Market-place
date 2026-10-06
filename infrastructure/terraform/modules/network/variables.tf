variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "cidr" {
  description = "VPC CIDR, a /16."
  type        = string
  validation {
    condition     = can(cidrhost(var.cidr, 0)) && endswith(var.cidr, "/16")
    error_message = "cidr must be a /16 network."
  }
}

variable "single_nat_gateway" {
  description = "One NAT gateway for all zones (cheaper; staging). Production uses one per zone."
  type        = bool
  default     = false
}

variable "log_kms_key_arn" {
  description = "KMS key encrypting the flow log group."
  type        = string
}
