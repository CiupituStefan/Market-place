# One-time, per AWS account: the S3 bucket that holds every other stack's state.
# Applied with local state by an administrator (SSO), then never touched by CI:
#   terraform -chdir=infrastructure/terraform/bootstrap init
#   terraform -chdir=infrastructure/terraform/bootstrap apply -var name=cse-tfstate-<account-id>
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

provider "aws" {
  region = var.region
  default_tags { tags = { project = "cse-keyboards", managed-by = "terraform", stack = "bootstrap" } }
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "name" {
  description = "Globally unique bucket name, e.g. cse-tfstate-<account-id>."
  type        = string
}

resource "aws_s3_bucket" "state" {
  #checkov:skip=CKV_AWS_18:Access is IAM-only and audited by CloudTrail data events; a log bucket would need its own state.
  #checkov:skip=CKV_AWS_144:Versioned; state can be rebuilt by importing. Cross-region replication is not worth a second bucket here.
  #checkov:skip=CKV2_AWS_62:No consumer for object events on the state bucket.
  bucket = var.name
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule { object_ownership = "BucketOwnerEnforced" }
}

# State files contain secrets of some resources: TLS only, keep old versions for 90 days.
resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}

output "bucket" {
  value = aws_s3_bucket.state.bucket
}
