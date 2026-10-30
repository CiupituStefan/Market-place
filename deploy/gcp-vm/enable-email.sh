#!/usr/bin/env bash
# Sends the shop's emails to real inboxes through Brevo's SMTP relay (docs/deploy-google-cloud.md):
#   sudo deploy/gcp-vm/enable-email.sh
# Asks for the Brevo SMTP login and key (hidden: they stay out of shell history, logs and Git),
# sends one test email to check them, writes SMTP_URL and EMAIL_FROM to deploy/gcp-vm/.env and
# restarts notification-service. `sudo deploy/gcp-vm/enable-email.sh --mailpit` goes back to
# keeping every email on the VM.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
env_file="$here/.env"
host='smtp-relay.brevo.com'
port=465 # TLS from the first byte: the key is never sent unencrypted

[ -f "$env_file" ] || { echo "No $env_file: run setup-vm.sh first." >&2; exit 1; }

set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$env_file" >"$tmp" || true
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  sudo install -m 600 "$tmp" "$env_file"
  rm -f "$tmp"
}

if [ "${1:-}" = "--mailpit" ]; then
  set_env SMTP_URL 'smtp://mailpit:1025'
  "$here/dc" up -d --wait notification-service
  echo "Emails stay in Mailpit on the VM again."
  exit 0
fi

read -rp 'Brevo SMTP login (Brevo > SMTP & API > SMTP, e.g. 9a1b2c001@smtp-brevo.com): ' login
read -rsp 'Brevo SMTP key (xsmtpsib-...): ' key
echo
read -rp 'Sender address [noreply@csekeyboards.com]: ' sender
sender="${sender:-noreply@csekeyboards.com}"
read -rp 'Send a test email to (your own address): ' test_to

# Checks the credentials and the sender before anything changes. Values go through the
# environment, not the command line.
LOGIN="$login" KEY="$key" SENDER="$sender" TO="$test_to" HOST="$host" PORT="$port" python3 - <<'PY'
import os, smtplib, ssl, sys, urllib.request
from email.message import EmailMessage
msg = EmailMessage()
msg["From"] = f"CSE Keyboards <{os.environ['SENDER']}>"
msg["To"] = os.environ["TO"]
msg["Subject"] = "CSE Keyboards: test email"
msg.set_content("If you can read this, the shop's emails are delivered through Brevo.")
try:
    with smtplib.SMTP_SSL(os.environ["HOST"], int(os.environ["PORT"]), context=ssl.create_default_context(), timeout=20) as smtp:
        smtp.login(os.environ["LOGIN"], os.environ["KEY"])
        smtp.send_message(msg)
except smtplib.SMTPAuthenticationError as error:
    detail = error.smtp_error.decode(errors="replace")
    if "IP" in detail:
        ip = urllib.request.urlopen("https://api.ipify.org", timeout=10).read().decode()
        sys.exit(f"Brevo refused this server's IP address ({ip}). Add it in Brevo > Security > "
                 "Authorised IPs (app.brevo.com/security/authorised_ips), then run this again.")
    sys.exit(f"Brevo refused the login: {detail}. Check the SMTP login and key, then run this again.")
except (OSError, smtplib.SMTPException) as error:
    sys.exit(f"Could not send the test email: {error}")
print(f"Test email sent to {os.environ['TO']}.")
PY

smtp_url="$(LOGIN="$login" KEY="$key" HOST="$host" PORT="$port" python3 -c '
import os, urllib.parse as u
e = os.environ
print("smtps://%s:%s@%s:%s" % (u.quote(e["LOGIN"], safe=""), u.quote(e["KEY"], safe=""), e["HOST"], e["PORT"]))')"
set_env SMTP_URL "$smtp_url"
set_env EMAIL_FROM "CSE Keyboards <${sender}>"
unset key smtp_url

"$here/dc" up -d --wait notification-service
echo "The shop's emails now go out through Brevo, from ${sender}."
