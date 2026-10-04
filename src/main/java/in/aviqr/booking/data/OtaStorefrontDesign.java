package in.aviqr.booking.data;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name="ota_storefront_designs")
public class OtaStorefrontDesign {
    @Id @Column(name="property_id") private UUID propertyId;
    @Column(nullable=false, length=32) private String preset;
    @Column(name="logo_url", length=500) private String logoUrl;
    @Column(name="favicon_url", length=500) private String faviconUrl;
    @Column(name="hero_title", length=120) private String heroTitle;
    @Column(length=200) private String tagline;
    protected OtaStorefrontDesign() { }
    public UUID getPropertyId(){return propertyId;} public String getPreset(){return preset;}
    public String getLogoUrl(){return logoUrl;} public String getFaviconUrl(){return faviconUrl;}
    public String getHeroTitle(){return heroTitle;} public String getTagline(){return tagline;}
}
