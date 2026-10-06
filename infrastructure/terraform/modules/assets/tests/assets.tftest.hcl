mock_provider "aws" {
  mock_data "aws_cloudfront_cache_policy" {
    defaults = { id = "658327ea-f89d-4fab-a63d-7e88639e58f6" }
  }
}

mock_provider "aws" {
  alias = "us_east_1"
}

# Validation records are keyed by domain_validation_options, unknown until AWS answers.
override_resource {
  override_during = plan
  target          = aws_acm_certificate.cdn
  values = {
    arn                 = "arn:aws:acm:us-east-1:123456789012:certificate/cdn"
    id                  = "arn:aws:acm:us-east-1:123456789012:certificate/cdn"
    key_algorithm       = "RSA_2048"
    not_after           = "2027-10-05T00:00:00Z"
    not_before          = "2026-10-05T00:00:00Z"
    region              = "us-east-1"
    renewal_eligibility = "ELIGIBLE"
    status              = "ISSUED"
    type                = "AMAZON_ISSUED"
    domain_validation_options = [
      { domain_name = "cdn.example.com", resource_record_name = "_a.cdn", resource_record_type = "CNAME", resource_record_value = "_c.acm" },
    ]
  }
}

variables {
  bucket_name    = "cse-test-images"
  cdn_domain     = "cdn.example.com"
  zone_id        = "Z0123456789ABCDEFGHIJ"
  upload_origins = ["www.example.com"]
}

run "private_bucket_https_cdn" {
  command = plan

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.images.block_public_acls,
      aws_s3_bucket_public_access_block.images.block_public_policy,
      aws_s3_bucket_public_access_block.images.ignore_public_acls,
      aws_s3_bucket_public_access_block.images.restrict_public_buckets,
    ])
    error_message = "The bucket is never public; CloudFront reads it with origin access control."
  }
  assert {
    condition     = aws_cloudfront_distribution.images.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https" && aws_cloudfront_distribution.images.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021"
    error_message = "HTTPS only, TLS 1.2+."
  }
  assert {
    condition     = one(aws_s3_bucket_cors_configuration.images.cors_rule).allowed_origins == toset(["https://www.example.com"])
    error_message = "Only the shop's own origin may upload."
  }
}
