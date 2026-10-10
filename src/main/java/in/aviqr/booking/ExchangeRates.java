package in.aviqr.booking;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Display currencies for guests. Rates from the hotel currency (INR) come from a public feed,
 * refreshed every 6 hours and kept when the feed is down; with no rates at all the storefront
 * simply shows INR. Bookings and payments are always charged in INR.
 */
@RestController
public class ExchangeRates {
    private static final Logger log = LoggerFactory.getLogger(ExchangeRates.class);
    private static final Duration REFRESH = Duration.ofHours(6);
    private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER = new com.fasterxml.jackson.databind.ObjectMapper();
    /** The currencies offered first in the switcher; every other rate the feed has is available too. */
    static final List<String> POPULAR = List.of("INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY", "CHF", "SAR", "QAR", "LKR", "NPR", "MYR", "THB");

    private final RestClient http;
    private final String feedUrl;
    private volatile Snapshot snapshot;
    private volatile Instant lastTry = Instant.EPOCH;

    record Snapshot(Map<String, BigDecimal> rates, Instant fetchedAt) { }

    public ExchangeRates(@Value("${aviqr.exchange-rates-url:https://open.er-api.com/v6/latest/INR}") String feedUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(4000);
        factory.setReadTimeout(6000);
        this.http = RestClient.builder().requestFactory(factory).build();
        this.feedUrl = feedUrl;
    }

    @GetMapping("/api/v1/ota/currencies")
    public Map<String, Object> currencies() {
        Snapshot s = current();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("base", "INR");
        out.put("rates", s == null ? Map.of("INR", BigDecimal.ONE) : s.rates());
        out.put("popular", POPULAR.stream().filter(c -> s == null ? "INR".equals(c) : s.rates().containsKey(c)).toList());
        if (s != null) out.put("updatedAt", s.fetchedAt());
        return out;
    }

    Snapshot current() {
        Snapshot s = snapshot;
        boolean stale = s == null || s.fetchedAt().plus(REFRESH).isBefore(Instant.now());
        // At most one feed call a minute, however many guests arrive while it's down.
        if (stale && lastTry.plusSeconds(60).isBefore(Instant.now())) {
            synchronized (this) {
                if (lastTry.plusSeconds(60).isBefore(Instant.now())) {
                    lastTry = Instant.now();
                    Snapshot fresh = fetch();
                    if (fresh != null) snapshot = fresh;
                }
            }
        }
        return snapshot;
    }

    private Snapshot fetch() {
        try {
            JsonNode body = MAPPER.readTree(http.get().uri(feedUrl).retrieve().body(String.class));
            JsonNode rates = body == null ? null : body.path("rates");
            if (rates == null || !rates.isObject() || !"success".equals(body.path("result").asText("success"))) return null;
            Map<String, BigDecimal> parsed = new TreeMap<>();
            rates.fields().forEachRemaining(e -> {
                if (e.getKey().matches("[A-Z]{3}") && e.getValue().isNumber() && e.getValue().decimalValue().signum() > 0)
                    parsed.put(e.getKey(), e.getValue().decimalValue());
            });
            parsed.put("INR", BigDecimal.ONE);
            return parsed.size() > 1 ? new Snapshot(Collections.unmodifiableMap(parsed), Instant.now()) : null;
        } catch (Exception e) {
            log.warn("Exchange rates unavailable: {}", e.getMessage());
            return null;
        }
    }
}
