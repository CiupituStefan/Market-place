# terraform -chdir=infrastructure/terraform/stacks/infra init -backend-config=../../envs/staging/infra.backend.hcl
bucket       = "cse-tfstate-REPLACE_WITH_ACCOUNT_ID"
key          = "staging/infra.tfstate"
region       = "eu-central-1"
encrypt      = true
use_lockfile = true
