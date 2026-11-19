package co.eci.operaciongaravito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.GameSessionService;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

/** Lo que lee Prometheus: el servidor real en un puerto al azar. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
class MonitoringTest {

    @Autowired
    private Environment environment;

    @Autowired
    private GameSessionService sessions;

    @Test
    @DisplayName("/actuator/prometheus expone las metricas del juego")
    void prometheusExposesGameMetrics() throws Exception {
        sessions.create("MONI", Building.F);
        String port = environment.getProperty("local.server.port");
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/actuator/prometheus")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode());
        String body = response.body();
        assertTrue(body.contains("garavito_rooms"), body.substring(0, Math.min(400, body.length())));
        assertTrue(body.contains("garavito_players"));
        assertTrue(body.contains("garavito_tick_seconds"));
        assertTrue(body.contains("garavito_messages_total"));
    }
}
