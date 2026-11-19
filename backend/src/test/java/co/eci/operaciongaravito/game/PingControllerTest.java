package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

class PingControllerTest {

    @Test
    @DisplayName("el ping responde la hora del servidor y prohibe guardarlo en cache")
    void pingAnswersServerTimeWithoutCache() {
        ResponseEntity<PingController.Pong> response = new PingController(() -> 1234L).ping();
        assertEquals(200, response.getStatusCode().value());
        assertEquals(1234L, response.getBody().serverTime());
        assertEquals("no-store", response.getHeaders().getCacheControl());
    }

    /** Por HTTP de verdad, con el servidor en un puerto al azar. */
    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
    @ActiveProfiles("dev")
    @org.junit.jupiter.api.Nested
    class OverHttp {

        @Autowired
        private Environment environment;

        @Test
        @DisplayName("GET /api/ping devuelve JSON con serverTime y no-store")
        void pingOverHttp() throws Exception {
            long before = System.currentTimeMillis();
            String port = environment.getProperty("local.server.port");
            HttpResponse<String> response = HttpClient.newHttpClient().send(
                    HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/ping")).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode());
            assertEquals("no-store", response.headers().firstValue("Cache-Control").orElse(""));
            long serverTime = Long.parseLong(response.body().replaceAll("\\D", ""));
            assertTrue(serverTime >= before, response.body());
        }
    }
}
