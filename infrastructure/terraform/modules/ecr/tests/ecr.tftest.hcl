mock_provider "aws" {}

variables {
  repositories = ["web", "order-service"]
  kms_key_arn  = "arn:aws:kms:eu-central-1:123456789012:key/mock"
}

run "immutable_scanned_encrypted" {
  command = plan

  assert {
    condition     = alltrue([for r in aws_ecr_repository.this : r.image_tag_mutability == "IMMUTABLE"])
    error_message = "A Git SHA tag must always mean the same image."
  }
  assert {
    condition     = alltrue([for r in aws_ecr_repository.this : r.image_scanning_configuration[0].scan_on_push])
    error_message = "Images are scanned on push."
  }
  assert {
    condition     = aws_ecr_repository.this["order-service"].name == "cse/order-service"
    error_message = "Repositories follow the chart's image naming (registry/cse/<name>)."
  }
}
