# AviQR Booking Engine

A standalone, white-label OTA and hotel booking storefront. The app has its own Spring Boot API, React UI, PostgreSQL persistence, Docker images, and HTTPS deployment. It reads active properties from AviQR and sends room inventory, stay quotes, and booking requests to AviQR PMS APIs. New reservations are created in PMS with the `DIRECT` source.

## Guest flow

- **Home:** popular destinations, **Famous stays** (ranked by confirmed bookings, saves and views in the last 30 days), **Recommended stays** (weighted towards cities the visitor explored or saved), recently viewed stays, an OpenStreetMap view of every property, and the full collection with filter and sort.
- **Property page:** amenities, check-in/out times, live room types and rate plans with date-specific PMS quotes, a location map, and the room picker.
- **Room picker:** the PMS room map shows each unit as available or booked by floor, without room numbers or guest data. Guests filter by side/wing and view, and pick an exact available room. Hotels set `mapX`/`mapY` to draw a real floor plan; otherwise rooms are laid out along a corridor grouped by side.
- **Room tour:** hotel-provided 360° panoramas, GLB/GLTF models and videos are shown when present. Every room also gets an illustrative three.js room sized by room type, with the window and view taken from the room's side/view, and a time-of-day ("4D") control that changes daylight, the view outside and room lighting. It is labelled illustrative.
- **Checkout and trips:** guest name and phone go to PMS, which creates a `DIRECT` reservation idempotently. Payment is taken at the property. **My trips** lists confirmed bookings made from that browser.

PostgreSQL stores booking references/idempotency state, anonymous favorites, per-visitor daily property views, and the visitor ID on bookings. Guest name/phone are not stored here. Each browser gets a random visitor ID. AviQR PMS remains the source of truth for inventory, rates and reservations.

Not implemented: online payment, guest email confirmation, multi-room checkout, accounts, booking changes/cancellation and reviews.

## Local development

Requirements: Java 21, Node 22, and PostgreSQL 15+ (or Docker). Use the committed Gradle wrapper (`./gradlew`).

```sh
# API
AVIQR_CORE_API=https://api.aviqr.com ./gradlew bootRun

# UI in another terminal; Vite proxies API requests to the backend
cd ui
npm install
npm run dev -- --host 0.0.0.0
```

Start local PostgreSQL (or `docker compose up -d postgres`) before `./gradlew bootRun`; configure `DATABASE_URL`, `DATABASE_USERNAME`, and `DATABASE_PASSWORD` as needed. Flyway applies the OTA schema at startup. For the Vite development proxy, set `VITE_OTA_API_TARGET=http://localhost:8080` in `ui/.env.local` (the production UI uses Nginx to proxy `/api` to the backend). The UI obtains its colors, title, logo, support contact, and optional property allowlist from `/api/v1/ota/config`.

## Separate branded customer deployment

Each customer deployment gets its own `.env`, domain, brand configuration, and container stack. Leave `PROPERTY_IDS` blank to show every active AviQR property. Set it to comma-separated property UUIDs (up to 100) when a client should see only an approved subset. The allowlist is enforced by the standalone API for listing, details, availability, quotes, and booking; PMS also validates room, rate-plan, and inventory data.

1. Point the chosen domain's DNS A/AAAA records to the deployment host. Allow inbound TCP ports 80 and 443 (plus UDP 443 for HTTP/3).
2. Copy `.env.example` to `.env`; configure `AVIQR_CORE_API`, `DOMAIN`, and `BRAND_*`. Add property IDs if the client has a restricted inventory.
3. Run `./deploy.sh`. Caddy obtains and renews the domain's TLS certificate. Docker Compose builds and runs the independent API and UI.
4. Set up backups for `booking_pgdata`, `caddy_data`, and `caddy_config`; monitor `/actuator/health` inside the API container and `docker compose logs -f`.

The AviQR API gateway must expose the public hotel search and PMS booking-engine routes. The public hotel-search routes added for this integration return a narrow DTO and omit hotel-owner email and phone. Keep the gateway and PMS public endpoints rate-limited in production. Configure the AviQR API's allowed origins if you later expose the backend API directly; this default uses same-origin `/api` proxying.

## Architecture

```text
Guest browser → Caddy (automatic TLS) → Nginx/React → standalone Booking API
                                                   ├─ AviQR hotel public search
                                                   └─ AviQR PMS room types, availability, quote, booking
```

The API acts as a same-origin proxy so the browser does not need direct AviQR service credentials. PostgreSQL stores OTA booking references and browser favorites; it does not replace PMS inventory or duplicate guest contact details. The Compose deployment includes a private PostgreSQL 17 database volume; set a unique long random `DATABASE_PASSWORD` before deployment. Do not put PMS credentials, internal secrets, signing keys, or payment provider secrets in the UI or its build variables. For a future private service-to-service deployment, use the AviQR gateway's authenticated internal integration contract and provision a dedicated service identity; never expose shared internal secrets to this public storefront.
# aviqr-booking-engine
# aviqr-booking-engine

## GitHub Actions deployment to GCP

`.github/workflows/deploy.yml` builds the Java API and React storefront on pull requests and pushes. A push to `master` also packages the project and deploys it over SSH to the GCE VM. A manual run can deploy from any selected branch. The workflow does not run automated tests.

### Prepare the GCE VM once

Use an Ubuntu 24.04 VM in `asia-south1` with 2 vCPU and 4 GB RAM. A 30 GB balanced boot disk is a practical starting point. Add a reserved external IPv4 address and VPC firewall ingress for TCP 22, 80, and 443 plus UDP 443. Point the booking domain's DNS A record at the VM.

After connecting as the non-root deployment user, run `sudo bash deploy/gcp-vm-setup.sh <ssh-user>`. Reconnect so the Docker group membership takes effect. Copy `.env.example` to `/opt/aviqr-booking-engine/.env` and configure the production domain, AviQR API, branding, and a unique `DATABASE_PASSWORD` (use `openssl rand -hex 24`). The workflow leaves `.env` out of its archive, so deploys preserve these server-side secrets.

### Configure repository secrets

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `GCP_VM_HOST`: the VM's reserved external IP address.
- `GCP_VM_USER`: the non-root SSH user prepared above.
- `GCP_VM_SSH_KEY`: that user's private SSH key in OpenSSH format.
- `GCP_VM_KNOWN_HOSTS`: the VM host-key line, verified against the instance before adding it.

Do not commit `.env` or private keys. The VM's firewall should allow SSH only from trusted sources where practical. Set up a GCP budget alert and monitor network egress; budget alerts notify but do not enforce a hard spending cap.


### Configure room locations and tour media

A hotel owner can set a room's map coordinates, side, view, and HTTPS media URLs through the authenticated hotel API: `PUT /api/v1/rooms/{roomId}/booking-display`. Coordinates are percentages from 0–100. Example body:

```json
{"floor":"3","roomSide":"East wing","viewType":"Garden view","mapX":72,"mapY":34,"panoramaUrl":"https://media.example.com/rooms/303-360.jpg","model3dUrl":"https://media.example.com/rooms/303.glb","tourVideoUrl":"https://media.example.com/rooms/303-tour.mp4"}
```

PMS returns room IDs and these presentation fields only for the date-selected room map; it omits room numbers and guest occupancy. On reservation it checks that the selected physical room is still available and creates the PMS reservation idempotently. Deploy the AviQR hotel-service and PMS changes, including the SQL in `aviqr-backend/deploy/db-migrations/`, before enabling room selection in this storefront.
# aviqr-booking-engine
