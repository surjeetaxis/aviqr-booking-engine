package in.aviqr.booking;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.MGF1ParameterSpec;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class GatewayPayloadEncryptionTest {
    final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule())
        .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    record Booking(String guestName, LocalDate checkInDate) { }

    @Test
    void sealsABodyTheGatewayCanDecrypt() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        KeyPair pair = gen.generateKeyPair();
        var encryption = new GatewayPayloadEncryption(RestClient.create(), mapper);
        var key = new GatewayPayloadEncryption.GatewayKey("kid-1", pair.getPublic(), Instant.now().plusSeconds(60));

        String jwe = encryption.seal("POST", "/api/v1/pms/public/booking-engine/h1/book",
            new Booking("Asha", LocalDate.of(2026, 10, 20)), key).get("jwe");

        // Mirrors the gateway's PayloadEncryption.decrypt.
        String[] parts = jwe.split("\\.", -1);
        assertThat(parts).hasSize(5);
        var dec = Base64.getUrlDecoder();
        JsonNode header = mapper.readTree(dec.decode(parts[0]));
        assertThat(header.path("alg").asText()).isEqualTo("RSA-OAEP-256");
        assertThat(header.path("enc").asText()).isEqualTo("A256GCM");
        assertThat(header.path("kid").asText()).isEqualTo("kid-1");
        Cipher rsa = Cipher.getInstance("RSA/ECB/OAEPPadding");
        rsa.init(Cipher.DECRYPT_MODE, pair.getPrivate(), new OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT));
        byte[] cek = rsa.doFinal(dec.decode(parts[1]));
        byte[] ct = dec.decode(parts[3]), tag = dec.decode(parts[4]);
        byte[] packed = Arrays.copyOf(ct, ct.length + tag.length);
        System.arraycopy(tag, 0, packed, ct.length, tag.length);
        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, dec.decode(parts[2])));
        aes.updateAAD(parts[0].getBytes(StandardCharsets.US_ASCII));
        JsonNode payload = mapper.readTree(aes.doFinal(packed));

        assertThat(cek).hasSize(32);
        assertThat(dec.decode(parts[2])).hasSize(12);
        assertThat(payload.path("method").asText()).isEqualTo("POST");
        assertThat(payload.path("target").asText()).isEqualTo("/api/v1/pms/public/booking-engine/h1/book");
        assertThat(payload.path("jti").asText()).matches("[A-Za-z0-9_-]{22,64}");
        assertThat(Math.abs(Instant.now().getEpochSecond() - payload.path("iat").asLong())).isLessThan(5);
        assertThat(payload.path("body")).isEqualTo(mapper.valueToTree(Map.of("guestName", "Asha", "checkInDate", "2026-10-20")));
    }
}
