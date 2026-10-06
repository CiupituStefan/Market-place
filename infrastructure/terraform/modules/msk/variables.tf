variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  description = "Three data subnets, one per zone."
  type        = list(string)
}

variable "client_security_group_id" {
  type = string
}

variable "kms_key_arn" {
  description = "Customer-managed key (MSK refuses SCRAM secrets under the default key)."
  type        = string
}

variable "kafka_version" {
  type    = string
  default = "3.9.x"
}

variable "broker_instance_type" {
  type    = string
  default = "kafka.t3.small"
}

variable "broker_volume_gb" {
  type    = number
  default = 100
}

variable "users" {
  description = "SCRAM users, one per service."
  type        = list(string)
}

variable "credentials_version" {
  description = "Increase to rotate every SCRAM password (written to Secrets Manager)."
  type        = number
  default     = 1
}

variable "allow_all_authenticated" {
  description = "allow.everyone.if.no.acl.found: true only while the first ACLs are applied (bootstrap)."
  type        = bool
  default     = true
}
