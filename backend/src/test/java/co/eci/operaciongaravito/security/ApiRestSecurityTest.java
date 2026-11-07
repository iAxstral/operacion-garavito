package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Las APIs REST contra el servidor real (Tomcat incluido): metodos no permitidos,
 * parametros maliciosos y respuestas de error que no deben revelar nada interno.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@TestPropertySource(properties = "security.api.ratelimit-enabled=false")
class ApiRestSecurityTest {

    static final List<String> GET_APIS = List.of("/api/ranking", "/api/daily", "/api/estado", "/api/ping",
            "/api/buildings/F/hide-spots");
    /** Lo que nunca deberia aparecer en una respuesta de error. */
    static final Pattern FUGA = Pattern.compile(
            "(?i)exception|stacktrace|\"trace\"|at co\\.eci|co\\.eci\\.|org\\.springframework|apache tomcat|tomcat/\\d|jakarta\\.");

    @LocalServerPort
    int port;

    private final HttpClient http = HttpClient.newHttpClient();

    private HttpResponse<String> send(String method, String path) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        builder = switch (method) {
            case "GET" -> builder.GET();
            case "DELETE" -> builder.DELETE();
            default -> builder.method(method, HttpRequest.BodyPublishers.ofString("{\"x\":1}"))
                    .header("Content-Type", "application/json");
        };
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void sinFugas(HttpResponse<String> response) {
        assertFalse(FUGA.matcher(response.body()).find(), "la respuesta revela detalles internos: " + response.body());
        response.headers().firstValue("Server").ifPresent(server ->
                assertFalse(server.toLowerCase(Locale.ROOT).matches(".*(tomcat|\\d+\\.\\d+).*"), "Server: " + server));
        assertTrue(response.headers().firstValue("X-Powered-By").isEmpty());
    }

    @Test
    @DisplayName("todas las APIs rechazan POST, PUT y DELETE con 405 y sin detalles internos")
    void writeMethodsAreRejected() throws Exception {
        for (String path : GET_APIS) {
            for (String method : new String[] { "POST", "PUT", "DELETE" }) {
                HttpResponse<String> response = send(method, path);
                assertEquals(405, response.statusCode(), method + " " + path);
                sinFugas(response);
            }
        }
    }

    @Test
    @DisplayName("parametros maliciosos (SQL, %00, gigantes) devuelven la respuesta por defecto, nunca 500")
    void hostileParametersFallBackToDefaults() throws Exception {
        String huge = "A".repeat(4000);
        for (String path : new String[] {
                "/api/ranking?building=%27%3B%20DROP%20TABLE%20match_record--&mode=NORMAL",
                "/api/ranking?building=%00&mode=%00",
                "/api/ranking?building=" + huge + "&mode=" + huge,
                "/api/ranking?building=F&building=C&mode=HARD%27OR%271%27=%271",
                "/api/buildings/%27%20OR%201=1--/hide-spots",
                "/api/buildings/" + huge + "/hide-spots" }) {
            HttpResponse<String> response = send("GET", path);
            assertTrue(response.statusCode() == 200 || response.statusCode() == 400,
                    path.substring(0, Math.min(60, path.length())) + " -> " + response.statusCode());
            sinFugas(response);
        }
        HttpResponse<String> ranking = send("GET", "/api/ranking?building=%27%3B%20DROP%20TABLE%20match_record--");
        assertTrue(ranking.body().contains("\"building\":\"F\""), "deberia caer al edificio por defecto: " + ranking.body());
    }

    @Test
    @DisplayName("404, 405 y 400 no muestran trazas, clases, rutas internas ni la version de Tomcat")
    void errorsRevealNothing() throws Exception {
        HttpResponse<String> notFound = send("GET", "/api/no-existe");
        assertEquals(404, notFound.statusCode());
        sinFugas(notFound);
        sinFugas(send("PATCH", "/api/ranking"));
        // Tomcat rechaza esto antes de llegar a Spring (barra codificada): su pagina de error.
        HttpResponse<String> badPath = send("GET", "/api/buildings/..%2F..%2Fetc%2Fpasswd/hide-spots");
        assertEquals(400, badPath.statusCode());
        sinFugas(badPath);
        HttpResponse<String> nullByte = send("GET", "/api/buildings/F%00/hide-spots");
        assertTrue(nullByte.statusCode() == 400 || nullByte.statusCode() == 200, "%00 -> " + nullByte.statusCode());
        sinFugas(nullByte);
    }
}
