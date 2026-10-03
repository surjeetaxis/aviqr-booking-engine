# AviQR Booking Engine

A standalone, white-label OTA and hotel booking storefront. The app has its own Spring Boot API, React UI, Docker images, and HTTPS deployment. It reads active properties from AviQR and sends room inventory, stay quotes, and booking requests to AviQR PMS APIs. New reservations are created in PMS with the `DIRECT` source.

## Guest flow

Guests search the active AviQR property directory by property, city, and travel dates; open property details; compare active room types and rate plans; see live room availability and date-specific PMS price quotes; and submit a direct booking. Availability and quote values are refreshed for the selected dates. The PMS is authoritative and can reject a stale or invalid selection during booking.

The current PMS public booking request requires guest name and phone. Payment collection, guest email persistence/confirmation, multi-room checkout, customer accounts, booking changes/cancellation, reviews, loyalty, and third-party channel-manager inventory are not implemented by the current source PMS API. Add each capability through an explicit client/provider requirement and PMS API contract. This release does not collect card data.

## Local development

Requirements: Java 21, Node 22, and Gradle 8 (or Docker).

```sh
# API
AVIQR_CORE_API=https://api.aviqr.in gradle bootRun

# UI in another terminal; Vite proxies API requests to the backend
cd ui
npm install
npm run dev -- --host 0.0.0.0
```

For the Vite development proxy, set `VITE_OTA_API_TARGET=http://localhost:8080` in `ui/.env.local` (the production UI uses Nginx to proxy `/api` to the backend). The UI obtains its colors, title, logo, support contact, and optional property allowlist from `/api/v1/ota/config`.

## Separate branded customer deployment

Each customer deployment gets its own `.env`, domain, brand configuration, and container stack. Leave `PROPERTY_IDS` blank to show every active AviQR property. Set it to comma-separated property UUIDs (up to 100) when a client should see only an approved subset. The allowlist is enforced by the standalone API for listing, details, availability, quotes, and booking; PMS also validates room, rate-plan, and inventory data.

1. Point the chosen domain's DNS A/AAAA records to the deployment host. Allow inbound TCP ports 80 and 443 (plus UDP 443 for HTTP/3).
2. Copy `.env.example` to `.env`; configure `AVIQR_CORE_API`, `DOMAIN`, and `BRAND_*`. Add property IDs if the client has a restricted inventory.
3. Run `./deploy.sh`. Caddy obtains and renews the domain's TLS certificate. Docker Compose builds and runs the independent API and UI.
4. Set up backups for Docker volumes `caddy_data` and `caddy_config`; monitor `/actuator/health` inside the API container and `docker compose logs -f`.

The AviQR API gateway must expose the public hotel search and PMS booking-engine routes. The public hotel-search routes added for this integration return a narrow DTO and omit hotel-owner email and phone. Keep the gateway and PMS public endpoints rate-limited in production. Configure the AviQR API's allowed origins if you later expose the backend API directly; this default uses same-origin `/api` proxying.

## Architecture

```text
Guest browser → Caddy (automatic TLS) → Nginx/React → standalone Booking API
                                                   ├─ AviQR hotel public search
                                                   └─ AviQR PMS room types, availability, quote, booking
```

The API acts as a same-origin proxy so the browser does not need direct AviQR service credentials. Do not put PMS credentials, internal secrets, signing keys, or payment provider secrets in the UI or its build variables. For a future private service-to-service deployment, use the AviQR gateway's authenticated internal integration contract and provision a dedicated service identity; never expose shared internal secrets to this public storefront.
# aviqr-booking-engine
# aviqr-booking-engine
