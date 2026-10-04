package in.aviqr.booking.data;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name="ota_property_views", uniqueConstraints=@UniqueConstraint(name="uk_ota_property_view_daily", columnNames={"visitor_id","property_id","view_date"}))
public class OtaPropertyView {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="visitor_id", nullable=false) private UUID visitorId;
    @Column(name="property_id", nullable=false) private UUID propertyId;
    @Column(name="view_date", nullable=false) private LocalDate viewDate;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    protected OtaPropertyView() { }
    public OtaPropertyView(UUID visitorId, UUID propertyId, LocalDate viewDate) {
        this.visitorId=visitorId; this.propertyId=propertyId; this.viewDate=viewDate; this.createdAt=Instant.now();
    }
    public UUID getVisitorId(){return visitorId;} public UUID getPropertyId(){return propertyId;}
    public LocalDate getViewDate(){return viewDate;}
}
