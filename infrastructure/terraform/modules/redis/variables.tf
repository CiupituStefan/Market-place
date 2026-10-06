variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "client_security_group_id" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "replicas" {
  description = "Read replicas (0 = single node; 1+ enables automatic failover across zones)."
  type        = number
  default     = 1
}

variable "secret_name" {
  description = "Secrets Manager name for the connection URL, e.g. cse/production/redis."
  type        = string
}

variable "auth_token_version" {
  description = "Increase to rotate the AUTH token (new value written to ElastiCache and the secret)."
  type        = number
  default     = 1
}
