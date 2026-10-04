-- Multi-room checkouts and the price breakdown shown to the guest.
ALTER TABLE ota_booking_orders ADD COLUMN room_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ota_booking_orders ADD COLUMN request_fingerprint VARCHAR(64);
ALTER TABLE ota_booking_orders ADD COLUMN addon_total NUMERIC(12, 2);
ALTER TABLE ota_booking_orders ADD COLUMN discount_total NUMERIC(12, 2);
ALTER TABLE ota_booking_orders ADD COLUMN estimated_taxes NUMERIC(12, 2);
ALTER TABLE ota_booking_orders ADD COLUMN grand_total NUMERIC(12, 2);
