package in.aviqr.booking.data;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OtaFavoriteRepository extends JpaRepository<OtaFavorite, UUID> {
    List<OtaFavorite> findByVisitorIdOrderByCreatedAtDesc(UUID visitorId);
    boolean existsByVisitorIdAndPropertyId(UUID visitorId, UUID propertyId);
    void deleteByVisitorIdAndPropertyId(UUID visitorId, UUID propertyId);
}
