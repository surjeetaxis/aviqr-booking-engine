package in.aviqr.booking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestClient;

@SpringBootApplication
@EnableConfigurationProperties(BookingEngineApplication.Brand.class)
public class BookingEngineApplication {
    public static void main(String[] args) { SpringApplication.run(BookingEngineApplication.class, args); }
    @Bean RestClient aviQr(RestClient.Builder builder, CoreProperties core) {
        return builder.baseUrl(core.api()).build();
    }
    @Bean CoreProperties coreProperties(org.springframework.core.env.Environment env) {
        return new CoreProperties(env.getProperty("aviqr.core-api", "https://api.aviqr.com"));
    }
    record CoreProperties(String api) {}
    @ConfigurationProperties("aviqr.brand")
    public record Brand(String name, String primary, String accent, String logo, String supportEmail, String propertyIds) {}
}
