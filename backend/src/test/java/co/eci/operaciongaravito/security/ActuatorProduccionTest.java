package co.eci.operaciongaravito.security;

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
import org.springframework.test.context.TestPropertySource;

/**
 * Configuracion de produccion (sin perfil dev): el actuator no esta en el puerto del
 * juego (8080, el que abre el Security Group) sino en uno de gestion solo en 127.0.0.1.
 * Se usa H2 en vez de PostgreSQL y un puerto de gestion al azar (MANAGEMENT_PORT=0).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:produccion;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MANAGEMENT_PORT=0",
})
class ActuatorProduccionTest {

    @Autowired
    Environment environment;

    private int get(String port, String path) throws Exception {
        return HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).build(),
                HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    @Test
    @DisplayName("en el puerto del juego no hay actuator (ni prometheus, ni env, ni heapdump)")
    void noActuatorOnGamePort() throws Exception {
        String port = environment.getProperty("local.server.port");
        for (String path : new String[] { "/actuator", "/actuator/prometheus", "/actuator/metrics", "/actuator/env",
                "/actuator/heapdump" }) {
            assertEquals(404, get(port, path), path);
        }
    }

    @Test
    @DisplayName("prometheus y health siguen en el puerto de gestion, solo en 127.0.0.1")
    void actuatorOnLoopbackManagementPort() throws Exception {
        String management = environment.getProperty("local.management.port");
        assertTrue(management != null && !management.equals(environment.getProperty("local.server.port")),
                "deberia haber un puerto de gestion aparte");
        assertEquals(200, get(management, "/actuator/prometheus"));
        assertEquals(200, get(management, "/actuator/health"));
        assertEquals("127.0.0.1", environment.getProperty("management.server.address"));
        assertEquals(404, get(management, "/actuator/env"));
    }
}
