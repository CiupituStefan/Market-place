# Regional WAF for the application load balancer: AWS managed rule groups (common exploits,
# known bad inputs, SQL injection, IP reputation) plus per-IP rate limits, tighter on the
# credential and checkout endpoints. Blocked requests are sampled and logged.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

variable "name" {
  type = string
}

variable "rate_limit_per_5min" {
  description = "Requests per IP per 5 minutes across the site."
  type        = number
  default     = 3000
}

variable "sensitive_rate_limit_per_5min" {
  description = "Requests per IP per 5 minutes on /api/v1/auth and /api/v1/orders."
  type        = number
  default     = 300
}

variable "kms_key_arn" {
  type = string
}

locals {
  managed_groups = [
    { name = "AWSManagedRulesAmazonIpReputationList", priority = 10 },
    { name = "AWSManagedRulesCommonRuleSet", priority = 20 },
    { name = "AWSManagedRulesKnownBadInputsRuleSet", priority = 30 },
    { name = "AWSManagedRulesSQLiRuleSet", priority = 40 },
  ]
}

resource "aws_wafv2_web_acl" "this" {
  name  = var.name
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  dynamic "rule" {
    for_each = local.managed_groups
    content {
      name     = rule.value.name
      priority = rule.value.priority
      override_action {
        none {}
      }
      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = rule.value.name
          # Product images are uploaded to S3 directly, but the review and checkout bodies
          # stay small; the common rule set's body-size rule is kept.
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.value.name
        sampled_requests_enabled   = true
      }
    }
  }

  rule {
    name     = "rate-sensitive"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.sensitive_rate_limit_per_5min
        aggregate_key_type = "IP"
        scope_down_statement {
          or_statement {
            statement {
              byte_match_statement {
                search_string         = "/api/v1/auth/"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
            statement {
              byte_match_statement {
                search_string         = "/api/v1/orders"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-sensitive"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-global"
    priority = 2
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-global"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = var.name
    sampled_requests_enabled   = true
  }
}

# WAF log group names must start with aws-waf-logs-.
resource "aws_cloudwatch_log_group" "this" {
  #checkov:skip=CKV_AWS_338:Request logs (redacted) for investigations: 30 days, not an audit trail.
  name              = "aws-waf-logs-${var.name}"
  retention_in_days = 30
  kms_key_id        = var.kms_key_arn
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.this.arn]
  redacted_fields {
    single_header { name = "authorization" }
  }
  redacted_fields {
    single_header { name = "cookie" }
  }
}

output "web_acl_arn" {
  value = aws_wafv2_web_acl.this.arn
}
