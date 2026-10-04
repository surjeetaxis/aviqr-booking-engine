-- Booking reference and the PMS-signed voucher token, so a guest's trips link to their voucher.
ALTER TABLE ota_booking_orders ADD COLUMN reference VARCHAR(16);
ALTER TABLE ota_booking_orders ADD COLUMN voucher_token VARCHAR(64);
