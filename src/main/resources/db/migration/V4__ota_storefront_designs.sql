-- Per-hotel storefront design for private booking engines: a design preset plus the
-- logo, tab icon and hero copy. Hotels without a row use the classic design.
CREATE TABLE ota_storefront_designs (
    property_id UUID PRIMARY KEY,
    preset VARCHAR(32) NOT NULL DEFAULT 'classic',
    logo_url VARCHAR(500),
    favicon_url VARCHAR(500),
    hero_title VARCHAR(120),
    tagline VARCHAR(200),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The Leela Resort, Goa (private storefront at leela.aviqr.com). Original demo artwork.
INSERT INTO ota_storefront_designs (property_id, preset, logo_url, favicon_url, hero_title, tagline)
VALUES ('0a035141-82b3-4e32-ae79-024ff06dba3f', 'resort-luxe', '/brand/leela/mark.svg', '/brand/leela/mark.svg',
        'Where the Arabian Sea meets quiet luxury',
        'Garden rooms, ocean suites and pool villas on the Goa coast. Choose your exact room and see the view before you arrive.');
