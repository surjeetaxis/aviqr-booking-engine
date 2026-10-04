package in.aviqr.booking;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.aviqr.booking.data.OtaBookingOrder;
import in.aviqr.booking.data.OtaBookingOrderRepository;
import in.aviqr.booking.data.OtaFavorite;
import in.aviqr.booking.data.OtaFavoriteRepository;
import in.aviqr.booking.data.OtaPropertyView;
import in.aviqr.booking.data.OtaPropertyViewRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@RestController
@RequestMapping("/api/v1/ota")
public class PublicBookingController {
    private final RestClient aviQr;
    private final BookingEngineApplication.Brand brand;
    private final OtaBookingOrderRepository bookingOrders;
    private final OtaFavoriteRepository favorites;
    private final OtaPropertyViewRepository views;
    private final ObjectMapper mapper;

    PublicBookingController(RestClient aviQr, BookingEngineApplication.Brand brand, OtaBookingOrderRepository bookingOrders,
            OtaFavoriteRepository favorites, OtaPropertyViewRepository views, ObjectMapper mapper) {
        this.aviQr=aviQr; this.brand=brand; this.bookingOrders=bookingOrders; this.favorites=favorites; this.views=views; this.mapper=mapper;
    }

    @GetMapping("/config") public Map<String,Object> config() {
        Map<String,Object> resolved=currentStorefront();
        if ("PUBLIC".equals(resolved.get("mode"))) {
            if (brand.name()!=null&&!brand.name().isBlank()) resolved.put("brand",brand.name());
            if (brand.primary()!=null&&!brand.primary().isBlank()) resolved.put("primary",brand.primary());
            if (brand.accent()!=null&&!brand.accent().isBlank()) resolved.put("accent",brand.accent());
            if (brand.logo()!=null&&!brand.logo().isBlank()) resolved.put("logo",brand.logo());
            if (brand.supportEmail()!=null&&!brand.supportEmail().isBlank()) resolved.put("supportEmail",brand.supportEmail());
            if (brand.propertyIds()!=null&&!brand.propertyIds().isBlank()) resolved.put("propertyIds",brand.propertyIds());
        }
        resolved.putIfAbsent("brand","AviQR Stays"); resolved.putIfAbsent("primary","#1f7257");
        resolved.putIfAbsent("accent","#d5a86b"); resolved.putIfAbsent("logo",""); resolved.putIfAbsent("supportEmail","");
        return resolved;
    }
    @GetMapping("/domains/authorize") public ResponseEntity<Void> authorizeCustomDomain(@RequestParam String domain) {
        get("/api/v1/hotels/public/booking-engine/domain-authorized?domain={domain}",domain);
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/properties") public Object properties(@RequestParam(defaultValue="") String q,
            @RequestParam(defaultValue="") String city, @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="24") int size) {
        Map<String,Object> storefront=currentStorefront();
        UUID tenantId=storefrontPropertyId(storefront);
        if (tenantId!=null) {
            Object property=fetchProperty(tenantId);
            return matches(property,q,city)?List.of(property):List.of();
        }
        var allowed=environmentPropertyIds();
        if (!allowed.isEmpty()) {
            return allowed.stream().map(this::fetchProperty).filter(x -> matches(x,q,city))
                .limit(Math.min(100,Math.max(1,size))).toList();
        }
        return get("/api/v1/hotels/public/booking-search?q={q}&city={city}&page={page}&size={size}", q, city, Math.max(0,page), Math.min(100,Math.max(1,size)));
    }
    @GetMapping("/properties/{hotelId}") public Object property(@PathVariable UUID hotelId) {
        requireAllowed(hotelId); return fetchProperty(hotelId);
    }
    /** Famous stays rank by recent confirmed bookings, saves and views; "for you" favours cities this visitor explored. */
    @GetMapping("/discover") public Map<String,Object> discover(@RequestParam UUID visitorId) {
        List<Map<String,Object>> rows=propertyRows(properties("","",0,100));
        LocalDate since=LocalDate.now(ZoneOffset.UTC).minusDays(30);
        Map<UUID,Long> booked=counts(bookingOrders.countConfirmedByPropertySince(since.atStartOfDay(ZoneOffset.UTC).toInstant()));
        Map<UUID,Long> viewed=counts(views.countByPropertySince(since)), saved=counts(favorites.countByProperty());
        Set<UUID> mine=favorites.findByVisitorIdOrderByCreatedAtDesc(visitorId).stream().map(OtaFavorite::getPropertyId).collect(Collectors.toSet());
        List<UUID> seen=views.findTop50ByVisitorIdOrderByCreatedAtDesc(visitorId).stream().map(OtaPropertyView::getPropertyId).distinct().toList();
        Map<UUID,Map<String,Object>> byId=new LinkedHashMap<>();
        Map<String,Long> affinity=new HashMap<>();
        for (var row:rows) {
            UUID id=asUuid(row.get("id")); byId.put(id,row);
            long b=booked.getOrDefault(id,0L);
            row.put("recentBookings",b); row.put("popularity",5*b+3*saved.getOrDefault(id,0L)+viewed.getOrDefault(id,0L));
            String city=String.valueOf(row.getOrDefault("city",""));
            if (!city.isBlank()) affinity.merge(city,(mine.contains(id)?2L:0L)+(seen.contains(id)?1L:0L),Long::sum);
        }
        Comparator<Map<String,Object>> popular=Comparator.<Map<String,Object>>comparingLong(r -> (Long)r.get("popularity")).reversed()
            .thenComparing(r -> -((Number)r.getOrDefault("totalRooms",0)).intValue());
        List<Map<String,Object>> famous=rows.stream().sorted(popular).limit(6).map(r -> {
            var x=new LinkedHashMap<>(r); long b=(Long)r.get("recentBookings");
            x.put("recommendationReason", b>0 ? b+(b==1?" stay":" stays")+" booked this month"
                : (Long)r.get("popularity")>0 ? "Trending with travellers" : "An AviQR signature stay");
            return (Map<String,Object>)x; }).toList();
        List<Map<String,Object>> forYou=rows.stream().sorted(Comparator.<Map<String,Object>>comparingLong(
                r -> affinity.getOrDefault(String.valueOf(r.getOrDefault("city","")),0L)).reversed().thenComparing(popular))
            .limit(6).map(r -> {
                var x=new LinkedHashMap<>(r); String city=String.valueOf(r.getOrDefault("city",""));
                x.put("recommendationReason", mine.contains(asUuid(r.get("id"))) ? "On your shortlist"
                    : affinity.getOrDefault(city,0L)>0 ? "Because you explored "+city : "Handpicked for your next trip");
                return (Map<String,Object>)x; }).toList();
        List<Map<String,Object>> recent=seen.stream().map(byId::get).filter(Objects::nonNull).limit(6).toList();
        List<Map<String,Object>> destinations=rows.stream().map(r -> String.valueOf(r.getOrDefault("city","")))
            .filter(c -> !c.isBlank() && !"null".equals(c)).collect(Collectors.groupingBy(c -> c,LinkedHashMap::new,Collectors.counting()))
            .entrySet().stream().sorted(Map.Entry.<String,Long>comparingByValue().reversed())
            .map(e -> Map.<String,Object>of("city",e.getKey(),"stays",e.getValue())).toList();
        return Map.of("famous",famous,"forYou",forYou,"recentlyViewed",recent,"destinations",destinations);
    }
    @PostMapping("/properties/{hotelId}/views") public ResponseEntity<Void> recordView(@PathVariable UUID hotelId,@RequestParam UUID visitorId) {
        requireAllowed(hotelId); LocalDate day=LocalDate.now(ZoneOffset.UTC);
        if (!views.existsByVisitorIdAndPropertyIdAndViewDate(visitorId,hotelId,day)) {
            try { views.save(new OtaPropertyView(visitorId,hotelId,day)); } catch (DataIntegrityViolationException alreadyRecorded) { }
        }
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/trips") public List<Map<String,Object>> trips(@RequestParam UUID visitorId) {
        return bookingOrders.findTop20ByVisitorIdAndStatusOrderByCreatedAtDesc(visitorId,"CONFIRMED").stream().map(this::confirmationData).toList();
    }
    @GetMapping("/properties/{hotelId}/room-types") public Object roomTypes(@PathVariable UUID hotelId) {
        requireAllowed(hotelId); return get("/api/v1/pms/public/booking-engine/{id}/room-types?storefrontHost={host}&storefrontSlug={slug}", hotelId,requestHost(),requestSlug());
    }
    @GetMapping("/properties/{hotelId}/availability") public Object availability(@PathVariable UUID hotelId,
            @RequestParam UUID roomTypeId, @RequestParam @FutureOrPresent LocalDate checkIn,
            @RequestParam @Future LocalDate checkOut) {
        requireAllowed(hotelId);
        return get("/api/v1/pms/public/booking-engine/{id}/availability?roomTypeId={room}&checkIn={in}&checkOut={out}&storefrontHost={host}&storefrontSlug={slug}", hotelId, roomTypeId, checkIn, checkOut,requestHost(),requestSlug());
    }
    @GetMapping("/properties/{hotelId}/room-map") public Object availableRooms(@PathVariable UUID hotelId,
            @RequestParam UUID roomTypeId, @RequestParam @FutureOrPresent LocalDate checkIn,
            @RequestParam @Future LocalDate checkOut) {
        requireAllowed(hotelId);
        return get("/api/v1/pms/public/booking-engine/{id}/room-map?roomTypeId={room}&checkIn={in}&checkOut={out}&storefrontHost={host}&storefrontSlug={slug}", hotelId, roomTypeId, checkIn, checkOut,requestHost(),requestSlug());
    }
    @GetMapping("/properties/{hotelId}/quote") public Object quote(@PathVariable UUID hotelId,
            @RequestParam UUID roomTypeId, @RequestParam UUID ratePlanId,
            @RequestParam @FutureOrPresent LocalDate checkIn, @RequestParam @Future LocalDate checkOut) {
        requireAllowed(hotelId);
        return get("/api/v1/pms/public/booking-engine/{id}/quote?roomTypeId={room}&ratePlanId={plan}&checkIn={in}&checkOut={out}&storefrontHost={host}&storefrontSlug={slug}", hotelId, roomTypeId, ratePlanId, checkIn, checkOut,requestHost(),requestSlug());
    }

    /** Add-ons and taxes; supported=false means this PMS can't take multi-room, add-on or promo checkouts yet. */
    @GetMapping("/properties/{hotelId}/extras") public Map<String,Object> extras(@PathVariable UUID hotelId) {
        requireAllowed(hotelId);
        try {
            JsonNode data=mapper.valueToTree(aviQr.get().uri("/api/v1/pms/public/booking-engine/{id}/extras?storefrontHost={host}&storefrontSlug={slug}",
                hotelId,requestHost(),requestSlug()).retrieve().body(Object.class)).path("data");
            return Map.of("supported",true,"addOns",mapper.convertValue(data.path("addOns"),List.class),"taxes",mapper.convertValue(data.path("taxes"),List.class));
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value()==404) return Map.of("supported",false,"addOns",List.of(),"taxes",List.of());
            throw new OtaUpstreamException(e);
        }
    }
    @GetMapping("/properties/{hotelId}/promo") public ResponseEntity<Object> promo(@PathVariable UUID hotelId,
            @RequestParam @Size(max=32) String code, @RequestParam(defaultValue="0") BigDecimal roomTotal,
            @RequestParam(required=false) LocalDate checkIn) {
        requireAllowed(hotelId);
        try {
            return ResponseEntity.ok(aviQr.get().uri("/api/v1/pms/public/booking-engine/{id}/promo?code={code}&roomTotal={total}&checkIn={in}&storefrontHost={host}&storefrontSlug={slug}",
                hotelId,code.trim(),roomTotal.max(BigDecimal.ZERO),checkIn==null?"":checkIn,requestHost(),requestSlug()).retrieve().body(Object.class));
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value()==404||e.getStatusCode().value()==400)
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message","That promo code isn't valid for this stay"));
            throw new OtaUpstreamException(e);
        }
    }

    @GetMapping("/favorites") public List<UUID> favoriteProperties(@RequestParam UUID visitorId) {
        return favorites.findByVisitorIdOrderByCreatedAtDesc(visitorId).stream().map(OtaFavorite::getPropertyId).toList();
    }
    @PutMapping("/favorites/{hotelId}") public ResponseEntity<Void> saveFavorite(@PathVariable UUID hotelId,@RequestParam UUID visitorId) {
        requireAllowed(hotelId);
        if (!favorites.existsByVisitorIdAndPropertyId(visitorId,hotelId)) favorites.save(new OtaFavorite(visitorId,hotelId));
        return ResponseEntity.noContent().build();
    }
    @DeleteMapping("/favorites/{hotelId}") public ResponseEntity<Void> removeFavorite(@PathVariable UUID hotelId,@RequestParam UUID visitorId) {
        favorites.deleteByVisitorIdAndPropertyId(visitorId,hotelId); return ResponseEntity.noContent().build();
    }

    @PostMapping(value="/properties/{hotelId}/book", consumes=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> book(@PathVariable UUID hotelId, @Valid @RequestBody BookingRequest request,
            @RequestHeader(value="Idempotency-Key", required=false) UUID suppliedKey) {
        requireAllowed(hotelId);
        List<RoomLine> lines=request.lines();
        if (lines.isEmpty()) return ResponseEntity.badRequest().body(Map.of("message","Choose at least one room"));
        if (lines.stream().map(RoomLine::roomId).distinct().count()!=lines.size())
            return ResponseEntity.badRequest().body(Map.of("message","Each room can only be chosen once"));
        boolean advanced=lines.size()>1||!request.addOnLines().isEmpty()||(request.promoCode()!=null&&!request.promoCode().isBlank());
        // An older PMS ignores unknown fields and would book only the first room, so never send it extras.
        if (advanced&&!Boolean.TRUE.equals(extras(hotelId).get("supported")))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message","This hotel can't take multi-room, add-on or promo bookings online yet"));
        UUID requestId=suppliedKey!=null?suppliedKey:UUID.randomUUID();
        String fingerprint=fingerprint(hotelId,request,lines);
        OtaBookingOrder order=bookingOrders.findByRequestId(requestId.toString()).orElse(null);
        if (order!=null && "CONFIRMED".equals(order.getStatus())) return ResponseEntity.ok(confirmation(order));
        if (order!=null && !fingerprint.equals(order.getRequestFingerprint()))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message","Idempotency key was already used for a different booking"));
        RoomLine first=lines.getFirst();
        if (order==null) {
            order=new OtaBookingOrder(requestId,request.visitorId(),hotelId,first.roomTypeId(),first.roomId(),request.checkInDate(),request.checkOutDate(),request.adults(),request.childCount());
            order.describe(lines.size(),fingerprint);
            try { order=bookingOrders.saveAndFlush(order); }
            catch (DataIntegrityViolationException duplicate) {
                order=bookingOrders.findByRequestId(requestId.toString()).orElse(null);
                if (order==null) throw duplicate;
                if ("CONFIRMED".equals(order.getStatus())) return ResponseEntity.ok(confirmation(order));
            }
        }
        try {
            BigDecimal roomTotal=BigDecimal.ZERO;
            String currency="INR";
            for (RoomLine line:lines) {
                JsonNode quote=mapper.valueToTree(get("/api/v1/pms/public/booking-engine/{id}/quote?roomTypeId={room}&ratePlanId={plan}&checkIn={in}&checkOut={out}&storefrontHost={host}&storefrontSlug={slug}",
                    hotelId,line.roomTypeId(),line.ratePlanId(),request.checkInDate(),request.checkOutDate(),requestHost(),requestSlug())).path("data");
                if (!quote.path("totalBeforeTax").isNumber()) throw new IllegalArgumentException("Missing quote");
                roomTotal=roomTotal.add(quote.path("totalBeforeTax").decimalValue());
                currency=quote.path("currency").asText(currency);
            }
            Object body=advanced
                ? new PmsCheckoutRequest(request.guestName().trim(),request.guestPhone().trim(),blankToNull(request.guestEmail()),blankToNull(request.specialRequests()),
                    request.checkInDate(),request.checkOutDate(),request.adults(),request.childCount(),lines,request.addOnLines(),blankToNull(request.promoCode()),
                    requestId,requestHost(),requestSlug())
                : new PmsBookingRequest(request.guestName().trim(),request.guestPhone().trim(),blankToNull(request.guestEmail()),blankToNull(request.specialRequests()),
                    request.checkInDate(),request.checkOutDate(),request.adults(),request.childCount(),first.roomTypeId(),first.ratePlanId(),first.roomId(),
                    requestId,requestHost(),requestSlug());
            Object result=aviQr.post().uri("/api/v1/pms/public/booking-engine/{id}/book",hotelId)
                .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(Object.class);
            JsonNode reservation=mapper.valueToTree(result).path("data");
            UUID pmsId=UUID.fromString(reservation.path("reservationId").asText(reservation.path("id").asText()));
            JsonNode totals=reservation.path("totals");
            if (totals.isObject()) {
                roomTotal=decimal(totals,"roomTotal",roomTotal);
                order.totals(decimal(totals,"addOnTotal",null),decimal(totals,"discount",null),decimal(totals,"estimatedTaxes",null),decimal(totals,"grandTotal",null));
            }
            order.confirm(pmsId,roomTotal,currency);
            order=bookingOrders.save(order);
            return ResponseEntity.ok(confirmation(order));
        } catch (RestClientResponseException e) {
            order.fail(); bookingOrders.save(order);
            JsonNode upstream=readJson(e.getResponseBodyAsString());
            String message=e.getStatusCode().value()==400&&upstream.path("message").isTextual()
                ? upstream.path("message").asText() : "The hotel could not confirm this booking";
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",message,"upstreamStatus",e.getStatusCode().value()));
        } catch (OtaUpstreamException e) {
            order.fail(); bookingOrders.save(order);
            throw e;
        } catch (IllegalArgumentException e) {
            order.fail(); bookingOrders.save(order);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message","PMS returned an invalid booking confirmation"));
        }
    }
    @GetMapping("/bookings/{bookingId}") public ResponseEntity<Object> booking(@PathVariable UUID bookingId) {
        return bookingOrders.findById(bookingId).map(o -> ResponseEntity.ok(confirmation(o)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private Object confirmation(OtaBookingOrder o) {
        return Map.of("success",true,"message","Booking status","data",confirmationData(o));
    }
    private Map<String,Object> confirmationData(OtaBookingOrder o) {
        Map<String,Object> data=new LinkedHashMap<>(); data.put("bookingId",o.getId());
        data.put("reservationId",o.getPmsReservationId()); data.put("status",o.getStatus()); data.put("hotelId",o.getPropertyId());
        data.put("roomTypeId",o.getRoomTypeId()); data.put("roomId",o.getRoomId()); data.put("checkIn",o.getCheckIn());
        data.put("checkOut",o.getCheckOut()); data.put("adults",o.getAdults()); data.put("children",o.getChildren());
        data.put("totalBeforeTax",o.getTotalBeforeTax()); data.put("currency",o.getCurrency()); data.put("createdAt",o.getCreatedAt());
        data.put("roomCount",o.getRoomCount()); data.put("addOnTotal",o.getAddOnTotal()); data.put("discount",o.getDiscountTotal());
        data.put("estimatedTaxes",o.getEstimatedTaxes()); data.put("grandTotal",o.getGrandTotal());
        return data;
    }
    private static String blankToNull(String v) { return v==null||v.isBlank()?null:v.trim(); }
    private static BigDecimal decimal(JsonNode node,String field,BigDecimal fallback) {
        return node.path(field).isNumber()?node.path(field).decimalValue():fallback;
    }
    private JsonNode readJson(String body) {
        try { return mapper.readTree(body==null||body.isBlank()?"{}":body); } catch (Exception e) { return mapper.createObjectNode(); }
    }
    /** Same key + same booking → same fingerprint, so a retry is recognised and a reused key is rejected. */
    private String fingerprint(UUID hotelId,BookingRequest r,List<RoomLine> lines) {
        String canonical=String.join("|",hotelId.toString(),String.valueOf(r.checkInDate()),String.valueOf(r.checkOutDate()),
            String.valueOf(r.adults()),String.valueOf(r.childCount()),r.guestPhone().trim(),
            lines.stream().map(l->l.roomTypeId()+"/"+l.ratePlanId()+"/"+l.roomId()).sorted().collect(Collectors.joining(",")),
            r.addOnLines().stream().map(a->a.addOnId()+"x"+a.quantity()).sorted().collect(Collectors.joining(",")),
            String.valueOf(blankToNull(r.promoCode())).toUpperCase(Locale.ROOT));
        try {
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private Object get(String path,Object... vars) {
        try { return aviQr.get().uri(path,vars).retrieve().body(Object.class); }
        catch (RestClientResponseException e) { throw new OtaUpstreamException(e); }
    }
    private List<Map<String,Object>> propertyRows(Object raw) {
        JsonNode root=mapper.valueToTree(raw);
        JsonNode data=root.isArray()?root:root.path("data");
        JsonNode rows=data.isArray()?data:data.path("content");
        if (!rows.isArray()) return new ArrayList<>();
        List<Map<String,Object>> output=new ArrayList<>();
        rows.forEach(node -> output.add(mapper.convertValue(node,Map.class)));
        return output;
    }
    private Object fetchProperty(UUID id) {
        Object raw=get("/api/v1/hotels/public/booking-engine/properties/{id}?host={host}&slug={slug}",id,requestHost(),requestSlug());
        return raw instanceof Map<?,?> map?map.get("data"):raw;
    }
    private boolean matches(Object x,String q,String city) {
        if (!(x instanceof Map<?,?> p)) return false;
        String haystack=(String.valueOf(p.get("name"))+" "+String.valueOf(p.get("city"))+" "+String.valueOf(p.get("address"))).toLowerCase();
        return (q==null||q.isBlank()||haystack.contains(q.toLowerCase()))&&(city==null||city.isBlank()||String.valueOf(p.get("city")).equalsIgnoreCase(city));
    }
    private Map<UUID,Long> counts(List<Object[]> rows) {
        Map<UUID,Long> out=new HashMap<>(); for (Object[] r:rows) out.put((UUID)r[0],((Number)r[1]).longValue()); return out;
    }
    private UUID asUuid(Object id) { return id instanceof UUID u?u:UUID.fromString(String.valueOf(id)); }
    private Set<UUID> environmentPropertyIds() {
        if (brand.propertyIds()==null||brand.propertyIds().isBlank()) return Set.of();
        try {
            List<UUID> ids=Arrays.stream(brand.propertyIds().split(",")).map(String::trim).filter(s->!s.isEmpty())
                .map(UUID::fromString).sorted(Comparator.comparing(UUID::toString)).toList();
            if(ids.size()>100)throw new IllegalStateException("PROPERTY_IDS supports at most 100 properties per storefront");
            return Collections.unmodifiableSet(new LinkedHashSet<>(ids));
        } catch(IllegalArgumentException e) { throw new IllegalStateException("PROPERTY_IDS must contain comma-separated property UUIDs",e); }
    }
    private void requireAllowed(UUID id) {
        Map<String,Object> storefront=currentStorefront();
        UUID tenantId=storefrontPropertyId(storefront);
        if (tenantId!=null&&!tenantId.equals(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        Set<UUID> allowed=environmentPropertyIds();
        if(!allowed.isEmpty()&&!allowed.contains(id))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        fetchProperty(id); // AviQR confirms the property is public or the request matches its private storefront.
    }
    private UUID storefrontPropertyId(Map<String,Object> storefront) {
        Object id=storefront.get("propertyId");
        if (id==null||String.valueOf(id).isBlank()||"PUBLIC".equals(storefront.get("mode"))) return null;
        try { return UUID.fromString(String.valueOf(id)); }
        catch (IllegalArgumentException ignored) { throw new ResponseStatusException(HttpStatus.NOT_FOUND); }
    }
    private Map<String,Object> currentStorefront() {
        Object raw=get("/api/v1/hotels/public/booking-engine/config?host={host}&slug={slug}",requestHost(),requestSlug());
        if (raw instanceof Map<?,?> root && root.get("data") instanceof Map<?,?> data)
            return mapper.convertValue(data,Map.class);
        return new LinkedHashMap<>();
    }
    private String requestHost() {
        ServletRequestAttributes attrs=(ServletRequestAttributes)RequestContextHolder.getRequestAttributes();
        if (attrs==null) return "";
        String host=attrs.getRequest().getHeader("X-Forwarded-Host");
        if (host==null||host.isBlank()) host=attrs.getRequest().getHeader("Host");
        return host==null?"":host.split(",")[0].trim();
    }
    private String requestSlug() {
        ServletRequestAttributes attrs=(ServletRequestAttributes)RequestContextHolder.getRequestAttributes();
        if (attrs==null) return "";
        String slug=attrs.getRequest().getParameter("slug");
        return slug==null?"":slug.trim();
    }
    public record BookingRequest(@NotBlank @Size(max=120) String guestName,
        @NotBlank @Pattern(regexp="^[+0-9() .-]{7,24}$") String guestPhone,
        @Email @Size(max=254) String guestEmail, @Size(max=200) String specialRequests,
        @NotNull @FutureOrPresent LocalDate checkInDate,@NotNull @Future LocalDate checkOutDate,
        @NotNull @Min(1) @Max(36) Integer adults,@Min(0) @Max(24) Integer children,
        UUID roomTypeId,UUID ratePlanId,UUID roomId,
        @Size(max=9) List<@Valid RoomLine> rooms, @Size(max=10) List<@Valid AddOnLine> addOns,
        @Size(max=32) String promoCode, UUID visitorId) {
        /** The rooms list, or the older single-room fields. */
        List<RoomLine> lines() {
            if (rooms!=null&&!rooms.isEmpty()) return rooms;
            return roomTypeId!=null&&ratePlanId!=null&&roomId!=null ? List.of(new RoomLine(roomTypeId,ratePlanId,roomId)) : List.of();
        }
        List<AddOnLine> addOnLines() { return addOns==null?List.of():addOns; }
        int childCount() { return children==null?0:children; }
    }
    public record RoomLine(@NotNull UUID roomTypeId,@NotNull UUID ratePlanId,@NotNull UUID roomId) { }
    public record AddOnLine(@NotNull UUID addOnId,@NotNull @Min(1) @Max(20) Integer quantity) { }
    private record PmsBookingRequest(String guestName,String guestPhone,String guestEmail,String specialRequests,LocalDate checkInDate,LocalDate checkOutDate,
        Integer adults,Integer children,UUID roomTypeId,UUID ratePlanId,UUID roomId,UUID bookingRequestId,String storefrontHost,String storefrontSlug) { }
    private record PmsCheckoutRequest(String guestName,String guestPhone,String guestEmail,String specialRequests,LocalDate checkInDate,LocalDate checkOutDate,
        Integer adults,Integer children,List<RoomLine> rooms,List<AddOnLine> addOns,String promoCode,UUID bookingRequestId,String storefrontHost,String storefrontSlug) { }
    @RestControllerAdvice static class Errors {
        @ExceptionHandler(OtaUpstreamException.class) ResponseEntity<Object> wrapped(OtaUpstreamException e) {
            return ResponseEntity.status(e.cause.getStatusCode()).body(Map.of("message","AviQR PMS is temporarily unavailable","upstreamStatus",e.cause.getStatusCode().value()));
        }
        @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<Object> badRequest(Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message","Invalid booking request"));
        }
    }
    static class OtaUpstreamException extends RuntimeException {
        private final RestClientResponseException cause;
        OtaUpstreamException(RestClientResponseException cause){super(cause);this.cause=cause;}
    }
}
