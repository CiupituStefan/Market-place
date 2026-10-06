environment       = "staging"
vpc_cidr          = "10.20.0.0/16"
domain            = "csekeyboards.com"
web_host          = "staging.csekeyboards.com"
api_host          = "api.staging.csekeyboards.com"
cdn_host          = "cdn.staging.csekeyboards.com"
github_repository = "CiupituStefan/Market-place"
# SSO permission set role(s) for operators; set per account.
cluster_admin_role_arns = []
dmarc_report_address    = "dmarc@csekeyboards.com"

# Cost over redundancy: one NAT gateway, single-AZ database and cache, small brokers.
sizing = {
  single_nat_gateway  = true
  node_instance_types = ["t3a.large"]
  node_min            = 2
  node_max            = 4
  db_instance_class   = "db.t4g.small"
  db_multi_az         = false
  db_storage_gb       = 20
  db_backup_days      = 7
  redis_node_type     = "cache.t4g.micro"
  redis_replicas      = 0
  kafka_broker_type   = "kafka.t3.small"
}

# Alerts (Amazon Managed Prometheus → SNS) and dashboards (Amazon Managed Grafana, signed in
# with IAM Identity Center; put the operators' group IDs in admin_group_ids).
alert_email = ""
grafana     = { enabled = true, admin_group_ids = [] }
