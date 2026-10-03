#!/usr/bin/env bash
set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "Run with sudo: sudo bash deploy/gcp-vm-setup.sh <ssh-user>" >&2
  exit 1
fi
deploy_user="${1:-${SUDO_USER:-}}"
if [[ -z "$deploy_user" || "$deploy_user" == root ]]; then
  echo "Pass the non-root SSH user that GitHub Actions will use." >&2
  exit 2
fi
id "$deploy_user" >/dev/null
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
usermod -aG docker "$deploy_user"
install -d -o "$deploy_user" -g "$deploy_user" -m 0750 /opt/aviqr-booking-engine
cat <<MSG
Docker and Docker Compose are ready. User '$deploy_user' was added to the docker group.
Reconnect over SSH, create /opt/aviqr-booking-engine/.env from the project's .env.example,
set DOMAIN and AVIQR_CORE_API plus client branding, then add these GitHub repository secrets:
GCP_VM_HOST, GCP_VM_USER, GCP_VM_SSH_KEY, GCP_VM_KNOWN_HOSTS.
MSG
