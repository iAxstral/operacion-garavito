package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Filtro de origen: con security.origin-secret, solo pasa lo que trae el header secreto
 * que agrega CloudFront. Asi una distribucion de CloudFront de OTRA cuenta (que tambien
 * entra por la prefix list del Security Group) no llega al backend.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "security.origin-secret=valor-secreto-de-prueba-123",
        "app.websocket.allowed-origins=http://localhost",
        "security.api.ratelimit-enabled=false",
})
class OrigenSecurityTest {

    static final String SECRET = "valor-secreto-de-prueba-123";

    @LocalServerPort
    int port;

    private final HttpClient http = HttpClient.newHttpClient();

    private int get(String path, String secret) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (secret != null) {
            builder.header("X-Origin-Verify", secret);
        }
        return http.send(builder.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    @Test
    @DisplayName("sin el header secreto (o con otro valor) todo responde 403, incluido el actuator")
    void requestsWithoutSecretAreRejected() throws Exception {
        for (String path : new String[] { "/api/ranking", "/api/estado", "/api/ping", "/actuator/prometheus", "/ws/info" }) {
            assertEquals(403, get(path, null), path + " sin header");
            assertEquals(403, get(path, "otro-valor"), path + " con valor equivocado");
        }
    }

    @Test
    @DisplayName("con el header correcto las APIs responden normal")
    void requestsWithSecretPass() throws Exception {
        assertEquals(200, get("/api/ranking", SECRET));
        assertEquals(200, get("/api/ping", SECRET));
    }

    @Test
    @DisplayName("el health check queda fuera del filtro (para chequeos locales de la maquina)")
    void healthIsExcluded() throws Exception {
        assertEquals(200, get("/actuator/health", null));
    }

    @Test
    @DisplayName("el handshake del WebSocket tambien exige el header")
    void websocketHandshakeNeedsSecret() throws Exception {
        Exception error = null;
        try {
            HttpClient.newHttpClient().newWebSocketBuilder().header("Origin", "http://localhost")
                    .buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), new WebSocket.Listener() { })
                    .get(5, TimeUnit.SECONDS).abort();
        } catch (Exception ex) {
            error = ex;
        }
        assertNotNull(error, "sin header no deberia conectar");

        WebSocket ok = HttpClient.newHttpClient().newWebSocketBuilder().header("Origin", "http://localhost")
                .header("X-Origin-Verify", SECRET)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), new WebSocket.Listener() { })
                .get(5, TimeUnit.SECONDS);
        ok.abort();
    }
}
