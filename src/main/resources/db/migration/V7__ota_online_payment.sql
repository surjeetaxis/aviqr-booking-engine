-- An online deposit or full payment started with the booking: where to pay and how much.
ALTER TABLE ota_booking_orders ADD COLUMN pay_url VARCHAR(500);
ALTER TABLE ota_booking_orders ADD COLUMN pay_amount NUMERIC(12, 2);
ALTER TABLE ota_booking_orders ADD COLUMN pay_kind VARCHAR(8);
