package in.aviqr.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@RestController
@RequestMapping("/api/v1/ota")
public class PublicBookingController {
    private final RestClient aviQr;
    private final BookingEngineApplication.Brand brand;
    PublicBookingController(RestClient aviQr, BookingEngineApplication.Brand brand) { this.aviQr = aviQr; this.brand = brand; }

    @GetMapping("/config") public Map<String,Object> config() {
        return Map.of("brand", brand.name(), "primary", brand.primary(), "accent", brand.accent(), "logo", brand.logo(), "supportEmail", brand.supportEmail(), "propertyIds", brand.propertyIds());
    }
    @GetMapping("/properties") public Object properties(@RequestParam(defaultValue="") String q,
            @RequestParam(defaultValue="") String city, @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="24") int size) {
        var allowed = allowedPropertyIds();
        if (!allowed.isEmpty()) {
            var results = allowed.stream().map(this::fetchProperty).filter(x -> matches(x, q, city)).limit(Math.min(100,Math.max(1,size))).toList();
            return results;
        }
        return get("/api/v1/hotels/public/booking-search?q={q}&city={city}&page={page}&size={size}", q, city, Math.max(0,page), Math.min(100,Math.max(1,size)));
    }
    @GetMapping("/properties/{hotelId}") public Object property(@PathVariable UUID hotelId) {
        requireAllowed(hotelId);
        return get("/api/v1/hotels/public/booking-search/{id}", hotelId);
    }
    private Object fetchProperty(UUID hotelId) { Object raw=get("/api/v1/hotels/public/booking-search/{id}", hotelId); return raw instanceof Map<?,?> map ? map.get("data") : raw; }
    private boolean matches(Object response, String query, String city) {
        if (!(response instanceof Map<?,?> hotel)) return false;
        String haystack = (String.valueOf(hotel.get("name"))+" "+String.valueOf(hotel.get("city"))+" "+String.valueOf(hotel.get("address"))).toLowerCase();
        return (query == null || query.isBlank() || haystack.contains(query.toLowerCase()))
            && (city == null || city.isBlank() || String.valueOf(hotel.get("city")).equalsIgnoreCase(city));
    }
    private java.util.Set<UUID> allowedPropertyIds() {
        if (brand.propertyIds() == null || brand.propertyIds().isBlank()) return java.util.Set.of();
        try {
            var ids = java.util.Arrays.stream(brand.propertyIds().split(",")).map(String::trim).filter(s -> !s.isEmpty())
                .map(UUID::fromString).sorted(java.util.Comparator.comparing(UUID::toString)).collect(java.util.stream.Collectors.toList());
            if (ids.size() > 100) throw new IllegalStateException("PROPERTY_IDS supports at most 100 properties per storefront");
            return java.util.Collections.unmodifiableSet(new java.util.LinkedHashSet<>(ids));
        } catch (IllegalArgumentException e) { throw new IllegalStateException("PROPERTY_IDS must contain comma-separated property UUIDs", e); }
    }
    private void requireAllowed(UUID hotelId) {
        var allowed=allowedPropertyIds();
        if (!allowed.isEmpty() && !allowed.contains(hotelId)) throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
    }
    @GetMapping("/properties/{hotelId}/room-types") public Object roomTypes(@PathVariable UUID hotelId) {
        requireAllowed(hotelId);
        return get("/api/v1/pms/public/booking-engine/{id}/room-types", hotelId);
    }
    @GetMapping("/properties/{hotelId}/availability") public Object availability(@PathVariable UUID hotelId,
            @RequestParam UUID roomTypeId, @RequestParam @FutureOrPresent LocalDate checkIn,
            @RequestParam @Future LocalDate checkOut) {
        requireAllowed(hotelId);
        return get("/api/v1/pms/public/booking-engine/{id}/availability?roomTypeId={room}&checkIn={in}&checkOut={out}", hotelId, roomTypeId, checkIn, checkOut);
    }
    @GetMapping("/properties/{hotelId}/quote") public Object quote(@PathVariable UUID hotelId,
            @RequestParam UUID roomTypeId, @RequestParam UUID ratePlanId,
            @RequestParam @FutureOrPresent LocalDate checkIn, @RequestParam @Future LocalDate checkOut) {
        requireAllowed(hotelId);
        return get("/api/v1/pms/public/booking-engine/{id}/quote?roomTypeId={room}&ratePlanId={plan}&checkIn={in}&checkOut={out}", hotelId, roomTypeId, ratePlanId, checkIn, checkOut);
    }
    @PostMapping(value="/properties/{hotelId}/book", consumes=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> book(@PathVariable UUID hotelId, @Valid @RequestBody BookingRequest request) {
        requireAllowed(hotelId);
        try {
            Object result=aviQr.post().uri("/api/v1/pms/public/booking-engine/{id}/book", hotelId)
                .contentType(MediaType.APPLICATION_JSON).body(request).retrieve().body(Object.class);
            return ResponseEntity.ok(result);
        } catch (RestClientResponseException e) { return ResponseEntity.status(e.getStatusCode()).body(error(e)); }
    }
    private Object get(String path, Object... vars) {
        try { return aviQr.get().uri(path, vars).retrieve().body(Object.class); }
        catch (RestClientResponseException e) { throw new OtaUpstreamException(e); }
    }
    private static Map<String,Object> error(RestClientResponseException e) {
        return Map.of("message", "Booking request could not be completed", "upstreamStatus", e.getStatusCode().value());
    }
    public record BookingRequest(@NotBlank @Size(max=120) String guestName,
        @NotBlank @Pattern(regexp="^[+0-9() .-]{7,24}$") String guestPhone,
        @NotNull @FutureOrPresent LocalDate checkInDate, @NotNull @Future LocalDate checkOutDate,
        @NotNull @Min(1) @Max(12) Integer adults, @Min(0) @Max(12) Integer children,
        @NotNull UUID roomTypeId, @NotNull UUID ratePlanId) { }
    @RestControllerAdvice static class Errors {
        @ExceptionHandler(RestClientResponseException.class) ResponseEntity<Object> upstream(RestClientResponseException e) {
            return ResponseEntity.status(e.getStatusCode()).body(error(e));
        }
        @ExceptionHandler(OtaUpstreamException.class) ResponseEntity<Object> wrapped(OtaUpstreamException e) {
            return ResponseEntity.status(e.getCause().getStatusCode()).body(error(e.getCause()));
        }
        @ExceptionHandler({IllegalArgumentException.class}) ResponseEntity<Object> badRequest(Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid booking search"));
        }
    }
    static class OtaUpstreamException extends RuntimeException {
        private final RestClientResponseException cause;
        OtaUpstreamException(RestClientResponseException cause) { super(cause); this.cause=cause; }
        @Override public synchronized RestClientResponseException getCause() { return cause; }
    }
}
