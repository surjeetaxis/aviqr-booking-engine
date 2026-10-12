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
# Replace a service's container without a gap: start one more on the new image beside the
# running one, wait until it reports healthy, then stop the old one. If the new container
# never gets healthy it is removed and the old one keeps serving. Database migrations run
# while the old API is still up, so they must stay compatible with the previous release.
rollout() {
  local svc=$1 old new status=starting
  docker compose rm -f "$svc" >/dev/null 2>&1 || true   # stopped leftovers only
  old=$(docker compose ps -q "$svc")
  if [[ -z "$old" ]]; then
    docker compose up -d --no-deps "$svc"
    return
  fi
  docker compose up -d --no-deps --no-recreate --scale "$svc=$(( $(wc -l <<<"$old") + 1 ))" "$svc"
  new=$(docker compose ps -q "$svc" | grep -vxF "$old")
  for _ in $(seq 1 60); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$new")
    [[ $status == healthy || $status == unhealthy ]] && break
    sleep 3
  done
  if [[ $status != healthy ]]; then
    echo "$svc: the new container is $status; keeping the running one." >&2
    docker logs --tail 50 "$new" >&2 || true
    docker rm -f "$new" >/dev/null
    exit 1
  fi
  docker stop -t 30 $old >/dev/null
  docker rm $old >/dev/null
  echo "$svc: replaced without downtime"
}

docker compose build
docker compose up -d --no-deps postgres
# The UI first: its nginx re-resolves the API, so the API swap after it is seamless.
rollout booking-ui
rollout booking-api
docker compose up -d --no-deps --no-recreate caddy
# Caddy bind-mounts deploy/Caddyfile, and a deploy replaces that file, so a running
# Caddy keeps the old copy. Recreate it whenever the Caddyfile changed.
caddy_sum=$(sha256sum deploy/Caddyfile | cut -d' ' -f1)
if [[ "$(cat .caddyfile.sha256 2>/dev/null)" != "$caddy_sum" ]]; then
  docker compose up -d --force-recreate --no-deps caddy
  echo "$caddy_sum" > .caddyfile.sha256
fi
echo "Booking engine deployed for ${DOMAIN}"
docker compose ps
