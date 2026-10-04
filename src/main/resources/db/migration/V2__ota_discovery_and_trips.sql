-- Anonymous per-visitor stay views power "Famous stays" and personal recommendations.
CREATE TABLE ota_property_views (
    id UUID PRIMARY KEY,
    visitor_id UUID NOT NULL,
    property_id UUID NOT NULL,
    view_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_ota_property_view_daily UNIQUE(visitor_id, property_id, view_date)
);
CREATE INDEX idx_ota_property_view_date ON ota_property_views(view_date, property_id);
CREATE INDEX idx_ota_property_view_visitor ON ota_property_views(visitor_id, created_at DESC);

-- Lets a browser list its own trips; guest name/phone stay in PMS only.
ALTER TABLE ota_booking_orders ADD COLUMN visitor_id UUID;
CREATE INDEX idx_ota_booking_visitor ON ota_booking_orders(visitor_id, created_at DESC);
