variable "bucket_name" {
  type = string
}

variable "cdn_domain" {
  description = "e.g. cdn.csekeyboards.com"
  type        = string
}

variable "zone_id" {
  description = "Route 53 hosted zone of the shop's domain."
  type        = string
}

variable "upload_origins" {
  description = "Domains of the web app that upload images (CORS)."
  type        = list(string)
}

variable "web_acl_arn" {
  description = "Optional CloudFront-scope WAF web ACL (us-east-1)."
  type        = string
  default     = null
}
