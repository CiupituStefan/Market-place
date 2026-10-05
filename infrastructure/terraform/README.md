# Terraform (AWS)

Built in **Phase 16**: modular AWS infrastructure (VPC, EKS, RDS PostgreSQL, ElastiCache Redis,
MSK, S3, ECR, CloudFront, WAF, IAM) with remote state in S3 + DynamoDB locking.
No credentials are ever hard-coded; CI authenticates through GitHub OIDC.
