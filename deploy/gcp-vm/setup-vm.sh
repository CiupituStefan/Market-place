#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04 VM and starts the backend (docs/deploy-google-cloud.md).
#   deploy/gcp-vm/setup-vm.sh <site-domain>
#   e.g. deploy/gcp-vm/setup-vm.sh csekeyboards.com
# Safe to run again: it keeps an existing .env (and so the admin password) and rebuilds/restarts.
set -euo pipefail

domain="${1:?usage: $0 <site-domain>}"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
env_file="$here/.env"

step() { printf '\n\033[1m── %s\033[0m\n' "$1"; }

step "1/7 Docker"
if ! command -v docker >/dev/null 2>&1; then
  # Docker's own apt repository (signed), not the distribution's older packages.
  sudo apt-get update -q
  sudo apt-get install -yq ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -q
  sudo apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
fi
sudo docker compose version

step "2/7 Swap (headroom for building the images on 8 GB)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
swapon --show

step "3/7 Settings ($env_file)"
if [ ! -f "$env_file" ]; then
  umask 077
  admin_password="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  cat > "$env_file" <<ENV
# Made by setup-vm.sh. Not in Git. Keep the admin password somewhere safe.
API_DOMAIN=api.$domain
SITE_URL=https://$domain
SITE_ORIGINS=https://$domain,https://www.$domain
COOKIE_DOMAIN=$domain
ADMIN_EMAIL=admin@$domain
ADMIN_PASSWORD=$admin_password
# Gateway rate limits stay on (as in production).
RATE_LIMIT_ENABLED=true
ENV
  echo "created (admin password generated)"
else
  echo "kept the existing settings"
fi
# Secrets added after the first install: generated once, never overwritten.
add_secret() {
  if ! sudo grep -q "^$1=" "$env_file"; then
    printf '%s=%s\n' "$1" "$2$(openssl rand -hex 32)" | sudo tee -a "$env_file" >/dev/null
    echo "generated $1"
  fi
}
add_secret UNSUBSCRIBE_SECRET ''
add_secret STRIPE_WEBHOOK_SECRET 'whsec_'
# One password per database role (docker-compose.yml only has public development values).
databases=(auth products inventory cart orders payments notifications reviews admin)
add_secret DB_PASSWORD_POSTGRES ''
for db in "${databases[@]}"; do add_secret "DB_PASSWORD_${db^^}" ''; done

step "4/7 Host: security updates, log rotation, Cloud Logging, backups"
# Security updates install themselves; a reboot they need happens at 04:00 (the services restart
# on their own).
sudo apt-get install -yq unattended-upgrades >/dev/null
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
sudo tee /etc/apt/apt.conf.d/52cse-unattended-upgrades >/dev/null <<'APT'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
APT
# Container logs: rotated on the VM (they could fill the disk), kept centrally by the Ops Agent.
daemon_json='{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" }, "live-restore": true }'
recreate=()
if [ "$(sudo cat /etc/docker/daemon.json 2>/dev/null)" != "$daemon_json" ]; then
  echo "$daemon_json" | sudo tee /etc/docker/daemon.json >/dev/null
  sudo systemctl restart docker
  recreate=(--force-recreate) # log options apply to containers created from now on
fi
if ! systemctl is-active --quiet google-cloud-ops-agent 2>/dev/null; then
  curl -fsSL https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh -o /tmp/add-ops-agent-repo.sh
  sudo bash /tmp/add-ops-agent-repo.sh --also-install >/dev/null
fi
sudo install -m 644 "$here/ops-agent.yaml" /etc/google-cloud-ops-agent/config.yaml
sudo systemctl restart google-cloud-ops-agent
# Daily database backup to Cloud Storage, once a bucket is set (docs/deploy-google-cloud.md).
if sudo grep -q '^BACKUP_BUCKET=.' "$env_file"; then
  sed "s#@BACKUP_SCRIPT@#$here/backup-db.sh#" "$here/cse-backup.service" |
    sudo tee /etc/systemd/system/cse-backup.service >/dev/null
  sudo install -m 644 "$here/cse-backup.timer" /etc/systemd/system/cse-backup.timer
  sudo systemctl daemon-reload
  sudo systemctl enable --now cse-backup.timer
  systemctl list-timers cse-backup.timer --no-pager | head -2
else
  echo "no BACKUP_BUCKET in $env_file: database backups not scheduled"
fi

step "5/7 Build the images (one at a time: about 30-45 minutes the first time)"
cd "$repo"
COMPOSE_PARALLEL_LIMIT=1 "$here/dc" build
sudo docker builder prune -af >/dev/null

step "6/7 Database passwords"
# The roles were created with the public development passwords; set the generated ones (again on
# every run, so .env stays the single source). Connects over the container's local socket.
cd "$repo"
"$here/dc" up -d --wait postgres
{
  for role in postgres "${databases[@]}"; do
    password="$(sudo grep "^DB_PASSWORD_${role^^}=" "$env_file" | cut -d= -f2)"
    printf "ALTER ROLE \"%s\" PASSWORD '%s';\n" "$role" "$password"
  done
} | "$here/dc" exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres
echo "set for postgres and ${#databases[@]} service roles"

step "7/7 Start"
# Every long-running service, waiting until each is healthy; then the one-off jobs (admin account,
# catalog, stock, discount codes, image bucket), which exit when done.
jobs='^(seed-admin|seed-catalog|seed-inventory|seed-discounts|storage-init)$'
mapfile -t services < <("$here/dc" config --services | grep -vE "$jobs")
"$here/dc" up -d "${recreate[@]}" --wait --wait-timeout 900 "${services[@]}"
"$here/dc" up -d seed-admin seed-catalog seed-inventory seed-discounts storage-init
# The Caddyfile is a bind-mounted file: `git pull` replaces it, so recreate Caddy to load it.
"$here/dc" up -d --force-recreate --no-deps caddy
"$here/dc" ps --format 'table {{.Service}}\t{{.Status}}'

api_domain="$(grep '^API_DOMAIN=' "$env_file" | cut -d= -f2)"
echo
echo "Backend started. Check:  curl https://$api_domain/health/ready"
echo "Admin: $(grep '^ADMIN_EMAIL=' "$env_file" | cut -d= -f2)"
echo "       password in $env_file (ADMIN_PASSWORD)"
