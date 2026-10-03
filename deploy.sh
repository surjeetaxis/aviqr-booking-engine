#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker Engine and the Docker Compose plugin are required." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env. Set DOMAIN, AVIQR_CORE_API and client branding, then run ./deploy.sh again."
  exit 2
fi
set -a
source .env
set +a
if [[ -z "${DOMAIN:-}" || -z "${AVIQR_CORE_API:-}" || -z "${DATABASE_PASSWORD:-}" || "${DATABASE_PASSWORD:-}" == "replace-with-a-unique-long-random-value" ]]; then
  echo "DOMAIN, AVIQR_CORE_API and a unique DATABASE_PASSWORD must be set in .env." >&2
  exit 2
fi
docker compose up --build -d
echo "Booking engine deployed for ${DOMAIN}"
docker compose ps
