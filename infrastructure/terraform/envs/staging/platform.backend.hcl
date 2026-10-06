# terraform -chdir=infrastructure/terraform/stacks/platform init -backend-config=../../envs/staging/platform.backend.hcl
bucket       = "cse-tfstate-REPLACE_WITH_ACCOUNT_ID"
key          = "staging/platform.tfstate"
region       = "eu-central-1"
encrypt      = true
use_lockfile = true
