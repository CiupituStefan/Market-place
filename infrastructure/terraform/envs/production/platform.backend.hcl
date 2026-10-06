# terraform -chdir=infrastructure/terraform/stacks/platform init -backend-config=../../envs/production/platform.backend.hcl
bucket       = "cse-tfstate-REPLACE_WITH_ACCOUNT_ID"
key          = "production/platform.tfstate"
region       = "eu-central-1"
encrypt      = true
use_lockfile = true
