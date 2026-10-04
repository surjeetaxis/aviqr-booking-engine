package in.aviqr.booking.data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface OtaPropertyViewRepository extends JpaRepository<OtaPropertyView, UUID> {
    boolean existsByVisitorIdAndPropertyIdAndViewDate(UUID visitorId, UUID propertyId, LocalDate viewDate);
    List<OtaPropertyView> findTop50ByVisitorIdOrderByCreatedAtDesc(UUID visitorId);
    @Query("select v.propertyId, count(v) from OtaPropertyView v where v.viewDate >= :since group by v.propertyId")
    List<Object[]> countByPropertySince(LocalDate since);
}
