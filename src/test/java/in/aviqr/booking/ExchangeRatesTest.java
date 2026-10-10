package in.aviqr.booking;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class ExchangeRatesTest {
    @Test
    @SuppressWarnings("unchecked")
    void readsTheFeedAndKeepsItWhenTheFeedFails() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer feed = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        feed.createContext("/latest", ex -> {
            byte[] body = (calls.incrementAndGet() == 1
                ? "{\"result\":\"success\",\"rates\":{\"INR\":1,\"USD\":0.012,\"EUR\":0.011,\"bad\":5,\"XXX\":-1}}"
                : "oops").getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        feed.start();
        try {
            ExchangeRates rates = new ExchangeRates("http://127.0.0.1:" + feed.getAddress().getPort() + "/latest");
            Map<String, Object> out = rates.currencies();
            Map<String, BigDecimal> r = (Map<String, BigDecimal>) out.get("rates");
            assertThat(r).containsOnlyKeys("INR", "USD", "EUR");
            assertThat(r.get("USD")).isEqualByComparingTo("0.012");
            assertThat((List<String>) out.get("popular")).startsWith("INR", "USD", "EUR");
            assertThat(rates.currencies().get("rates")).isEqualTo(r);
            assertThat(calls.get()).isEqualTo(1);
        } finally {
            feed.stop(0);
        }
    }

    @Test
    void withoutAFeedOnlyInrIsOffered() {
        ExchangeRates rates = new ExchangeRates("http://127.0.0.1:9/none");
        assertThat(rates.currencies()).containsEntry("popular", List.of("INR"));
    }
}
