package in.aviqr.booking;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/** The AviQR gateway only accepts JSON request bodies wrapped in a compact JWE
 *  (RSA-OAEP-256 / A256GCM) bound to the request method, path and time, the same
 *  scheme as aviqr-ui-web's payloadEncryption.js. Plain JSON is rejected with 400. */
@Component
public class GatewayPayloadEncryption {
    private static final Duration KEY_TTL = Duration.ofMinutes(10);
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private final RestClient aviQr;
    private final ObjectMapper mapper;
    private final SecureRandom random = new SecureRandom();
    Clock clock = Clock.systemUTC();
    private volatile GatewayKey cached;

    record GatewayKey(String kid, PublicKey key, Instant until) { }

    GatewayPayloadEncryption(RestClient aviQr, ObjectMapper mapper) { this.aviQr = aviQr; this.mapper = mapper; }

    /** The body to send to {@code method target}: encrypted when the gateway publishes a key. */
    public Object seal(String method, String target, Object body) {
        GatewayKey key = key();
        return key == null ? body : seal(method, target, body, key);
    }

    Map<String, String> seal(String method, String target, Object body, GatewayKey key) {
        try {
            byte[] header = mapper.writeValueAsBytes(Map.of("alg", "RSA-OAEP-256", "enc", "A256GCM", "kid", key.kid()));
            String encodedHeader = B64.encodeToString(header);
            Map<String, Object> content = new LinkedHashMap<>();
            content.put("method", method);
            content.put("target", target);
            content.put("iat", clock.instant().getEpochSecond());
            content.put("jti", B64.encodeToString(bytes(16)));
            content.put("body", mapper.valueToTree(body));
            byte[] cek = bytes(32), iv = bytes(12);
            Cipher rsa = Cipher.getInstance("RSA/ECB/OAEPPadding");
            rsa.init(Cipher.ENCRYPT_MODE, key.key(), new OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT));
            Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
            aes.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, iv));
            aes.updateAAD(encodedHeader.getBytes(StandardCharsets.US_ASCII));
            byte[] sealed = aes.doFinal(mapper.writeValueAsBytes(content));
            String jwe = String.join(".", encodedHeader, B64.encodeToString(rsa.doFinal(cek)), B64.encodeToString(iv),
                B64.encodeToString(Arrays.copyOf(sealed, sealed.length - 16)), B64.encodeToString(Arrays.copyOfRange(sealed, sealed.length - 16, sealed.length)));
            return Map.of("jwe", jwe);
        } catch (GeneralSecurityException | com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Could not encrypt the PMS request", e);
        }
    }

    private GatewayKey key() {
        GatewayKey current = cached;
        if (current != null && current.until().isAfter(clock.instant())) return current;
        try {
            JsonNode cfg = mapper.valueToTree(aviQr.get().uri("/api/v1/security/payload-key").retrieve().body(Object.class));
            if (!"RSA-OAEP-256".equals(cfg.path("alg").asText()) || !"A256GCM".equals(cfg.path("enc").asText()))
                throw new IllegalStateException("Unsupported gateway payload encryption");
            String pem = cfg.path("publicKey").asText().replaceAll("-----[^-]+-----|\\s", "");
            PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(pem)));
            if (((RSAPublicKey) publicKey).getModulus().bitLength() < 2048) throw new IllegalStateException("Gateway key is too short");
            cached = new GatewayKey(cfg.path("kid").asText(), publicKey, clock.instant().plus(KEY_TTL));
            return cached;
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) return null; // gateway without payload encryption
            throw e;
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Invalid gateway payload key", e);
        }
    }

    private byte[] bytes(int size) { byte[] b = new byte[size]; random.nextBytes(b); return b; }
}
