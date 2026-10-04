package in.aviqr.booking.data;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface OtaFavoriteRepository extends JpaRepository<OtaFavorite, UUID> {
    List<OtaFavorite> findByVisitorIdOrderByCreatedAtDesc(UUID visitorId);
    boolean existsByVisitorIdAndPropertyId(UUID visitorId, UUID propertyId);
    @Transactional void deleteByVisitorIdAndPropertyId(UUID visitorId, UUID propertyId);
    @Query("select f.propertyId, count(f) from OtaFavorite f group by f.propertyId")
    List<Object[]> countByProperty();
}
