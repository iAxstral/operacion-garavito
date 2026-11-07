package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** Limite de peticiones por IP en /api/**: quien pide en bucle recibe 429. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "security.api.ratelimit-enabled=true",
        "security.api.requests-per-second=5",
        "security.api.burst=10",
})
class ApiRateLimitTest {

    @LocalServerPort
    int port;

    @Autowired
    MeterRegistry registry;

    @Test
    @DisplayName("100 peticiones seguidas a /api/ranking: las que pasan del limite reciben 429")
    void apiIsRateLimited() throws Exception {
        HttpClient http = HttpClient.newHttpClient();
        int ok = 0;
        int limited = 0;
        for (int i = 0; i < 100; i++) {
            int status = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/ranking")).build(),
                    HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status == 200) {
                ok++;
            } else if (status == 429) {
                limited++;
            }
        }
        assertTrue(ok >= 10 && ok < 40, "pasaron " + ok);
        assertTrue(limited > 50, "limitadas " + limited);
        Counter counter = registry.find("garavito.rejected").tag("reason", "api_rate_limit").counter();
        assertTrue(counter != null && counter.count() >= limited);
    }

    @Test
    @DisplayName("el ritmo de la pagina de estado (1 cada 3 s) y el ping no se limitan")
    void normalPollingPasses() throws Exception {
        HttpClient http = HttpClient.newHttpClient();
        Thread.sleep(2500); // que se recargue la cubeta de la prueba anterior
        for (int i = 0; i < 6; i++) {
            assertEquals(200, http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/estado")).build(),
                    HttpResponse.BodyHandlers.discarding()).statusCode());
            Thread.sleep(300);
        }
    }
}
