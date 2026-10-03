package in.aviqr.booking.data;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name="ota_booking_orders", uniqueConstraints=@UniqueConstraint(name="uk_ota_booking_request", columnNames="request_id"))
public class OtaBookingOrder {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="request_id", nullable=false, length=36) private String requestId;
    @Column(name="pms_reservation_id", unique=true) private UUID pmsReservationId;
    @Column(name="property_id", nullable=false) private UUID propertyId;
    @Column(name="room_type_id", nullable=false) private UUID roomTypeId;
    @Column(name="room_id", nullable=false) private UUID roomId;
    @Column(name="check_in", nullable=false) private LocalDate checkIn;
    @Column(name="check_out", nullable=false) private LocalDate checkOut;
    @Column(nullable=false) private Integer adults;
    @Column(nullable=false) private Integer children;
    @Column(name="total_before_tax", precision=12, scale=2) private BigDecimal totalBeforeTax;
    @Column(length=3) private String currency;
    @Column(nullable=false, length=16) private String status;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;

    protected OtaBookingOrder() { }
    public OtaBookingOrder(UUID requestId, UUID propertyId, UUID roomTypeId, UUID roomId,
                           LocalDate checkIn, LocalDate checkOut, Integer adults, Integer children) {
        this.requestId=requestId.toString(); this.propertyId=propertyId; this.roomTypeId=roomTypeId; this.roomId=roomId;
        this.checkIn=checkIn; this.checkOut=checkOut; this.adults=adults; this.children=children;
        this.status="PROCESSING"; this.createdAt=Instant.now(); this.updatedAt=this.createdAt;
    }
    public void confirm(UUID pmsReservationId, BigDecimal totalBeforeTax, String currency) {
        this.pmsReservationId=pmsReservationId; this.totalBeforeTax=totalBeforeTax; this.currency=currency;
        this.status="CONFIRMED"; this.updatedAt=Instant.now();
    }
    public void fail() { this.status="FAILED"; this.updatedAt=Instant.now(); }
    public UUID getId(){return id;} public String getRequestId(){return requestId;}
    public UUID getPmsReservationId(){return pmsReservationId;} public UUID getPropertyId(){return propertyId;}
    public UUID getRoomTypeId(){return roomTypeId;} public UUID getRoomId(){return roomId;}
    public LocalDate getCheckIn(){return checkIn;} public LocalDate getCheckOut(){return checkOut;}
    public Integer getAdults(){return adults;} public Integer getChildren(){return children;}
    public BigDecimal getTotalBeforeTax(){return totalBeforeTax;} public String getCurrency(){return currency;}
    public String getStatus(){return status;}
}
