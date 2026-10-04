-- Gift voucher amount applied at checkout and what remains to pay at the hotel.
ALTER TABLE ota_booking_orders ADD COLUMN voucher_applied NUMERIC(12, 2);
ALTER TABLE ota_booking_orders ADD COLUMN balance_due NUMERIC(12, 2);
