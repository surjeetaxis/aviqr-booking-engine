package in.aviqr.booking.data;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OtaBookingOrderRepository extends JpaRepository<OtaBookingOrder, UUID> {
    Optional<OtaBookingOrder> findByRequestId(String requestId);
    Optional<OtaBookingOrder> findByIdAndStatus(UUID id, String status);
    long countByPropertyIdAndStatus(UUID propertyId, String status);
}
