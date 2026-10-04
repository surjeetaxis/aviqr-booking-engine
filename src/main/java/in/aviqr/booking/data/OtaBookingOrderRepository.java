package in.aviqr.booking.data;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface OtaBookingOrderRepository extends JpaRepository<OtaBookingOrder, UUID> {
    Optional<OtaBookingOrder> findByRequestId(String requestId);
    Optional<OtaBookingOrder> findByIdAndStatus(UUID id, String status);
    long countByPropertyIdAndStatus(UUID propertyId, String status);
    List<OtaBookingOrder> findTop20ByVisitorIdAndStatusOrderByCreatedAtDesc(UUID visitorId, String status);
    @Query("select o.propertyId, count(o) from OtaBookingOrder o where o.status='CONFIRMED' and o.createdAt >= :since group by o.propertyId")
    List<Object[]> countConfirmedByPropertySince(Instant since);
}
