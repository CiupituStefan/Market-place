environment             = "production"
vpc_cidr                = "10.30.0.0/16"
domain                  = "csekeyboards.com"
web_host                = "www.csekeyboards.com"
api_host                = "api.csekeyboards.com"
cdn_host                = "cdn.csekeyboards.com"
github_repository       = "ciupitustefan/market-place"
cluster_admin_role_arns = []
dmarc_report_address    = "dmarc@csekeyboards.com"

# Redundant across three zones: NAT per zone, Multi-AZ database, cache replica.
sizing = {
  single_nat_gateway  = false
  node_instance_types = ["m7i.large", "m6i.large"]
  node_min            = 3
  node_max            = 12
  db_instance_class   = "db.m7g.large"
  db_multi_az         = true
  db_storage_gb       = 100
  db_backup_days      = 14
  redis_node_type     = "cache.t4g.small"
  redis_replicas      = 1
  kafka_broker_type   = "kafka.m7g.large"
}
