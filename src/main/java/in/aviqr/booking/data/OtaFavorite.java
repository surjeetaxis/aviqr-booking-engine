package in.aviqr.booking.data;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="ota_favorites", uniqueConstraints=@UniqueConstraint(name="uk_ota_favorite_visitor_property", columnNames={"visitor_id","property_id"}))
public class OtaFavorite {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="visitor_id", nullable=false) private UUID visitorId;
    @Column(name="property_id", nullable=false) private UUID propertyId;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    protected OtaFavorite() { }
    public OtaFavorite(UUID visitorId, UUID propertyId) { this.visitorId=visitorId; this.propertyId=propertyId; this.createdAt=Instant.now(); }
    public UUID getVisitorId(){return visitorId;} public UUID getPropertyId(){return propertyId;}
}
