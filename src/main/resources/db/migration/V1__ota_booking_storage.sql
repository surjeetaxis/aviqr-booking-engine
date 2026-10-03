CREATE TABLE ota_booking_orders (
    id UUID PRIMARY KEY,
    request_id VARCHAR(36) NOT NULL UNIQUE,
    pms_reservation_id UUID UNIQUE,
    property_id UUID NOT NULL,
    room_type_id UUID NOT NULL,
    room_id UUID NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    adults INTEGER NOT NULL,
    children INTEGER NOT NULL,
    total_before_tax NUMERIC(12, 2),
    currency VARCHAR(3),
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_ota_booking_property_created ON ota_booking_orders(property_id, created_at DESC);
CREATE INDEX idx_ota_booking_status ON ota_booking_orders(status);

CREATE TABLE ota_favorites (
    id UUID PRIMARY KEY,
    visitor_id UUID NOT NULL,
    property_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_ota_favorite_visitor_property UNIQUE(visitor_id, property_id)
);
CREATE INDEX idx_ota_favorite_visitor ON ota_favorites(visitor_id, created_at DESC);
