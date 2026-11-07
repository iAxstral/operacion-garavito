package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.GameSessionService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Ataques al canal STOMP: leer salas ajenas, publicar en el topic de otros, abrir
 * suscripciones sin fin, inundar de mensajes y mandar frames gigantes.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "app.websocket.allowed-origins=http://localhost",
        "security.ratelimit.enabled=true",
        "security.ratelimit.messages-per-second=40",
        "security.ratelimit.burst=80",
        "security.ratelimit.max-violations=100",
        "security.ws.time-to-first-message-ms=1500",
})
class CanalStompSecurityTest {

    static final String ORIGIN = "http://localhost";

    @LocalServerPort
    int port;

    @Autowired
    GameSessionService sessions;

    @Autowired
    MeterRegistry registry;

    private double rejected(String reason) {
        Counter counter = registry.find("garavito.rejected").tag("reason", reason).counter();
        return counter == null ? 0 : counter.count();
    }

    /** Una sala con un jugador sentado; devuelve su cliente (suscrito a su topic). */
    private RawStompClient victima(String code) throws Exception {
        sessions.create(code, Building.F);
        RawStompClient victim = RawStompClient.connect(port, ORIGIN);
        victim.subscribe("/topic/game/" + code);
        Thread.sleep(150);
        victim.send("/app/game/" + code + "/join",
                "{\"role\":\"SEGURIDAD\",\"clientId\":\"victima1\",\"token\":\"token-de-la-victima-1234\",\"name\":\"V\"}");
        assertNotNull(victim.awaitBody("JOIN_OK", 3000), "la victima deberia entrar");
        return victim;
    }

    @Test
    @DisplayName("suscribirse con comodines (/topic/**, /topic/game/*) no deja leer las salas")
    void wildcardSubscribeIsRejected() throws Exception {
        try (RawStompClient victim = victima("COMO01"); RawStompClient spy = RawStompClient.connect(port, ORIGIN)) {
            double before = rejected("bad_subscribe");
            spy.subscribe("/topic/**");
            spy.subscribe("/topic/game/*");
            Thread.sleep(200);
            // La victima genera trafico en su sala.
            victim.send("/app/game/COMO01/ping", "{\"playerId\":\"SEGURIDAD\",\"kind\":\"HELP\"}");
            Thread.sleep(600);
            assertTrue(spy.messages().stream().noneMatch(f -> f.body().contains("SEGURIDAD")),
                    "el espia leyo la sala ajena: " + spy.messages().size() + " mensajes");
            assertTrue(rejected("bad_subscribe") > before, "deberia contarse el rechazo");
            assertTrue(spy.awaitClosed(2000), "una suscripcion maliciosa corta la conexion");
        }
    }

    @Test
    @DisplayName("no se puede suscribir a destinos que no son una sala (/topic/otra, /queue/x de otro)")
    void otherSubscriptionsAreRejected() throws Exception {
        for (String destination : new String[] { "/topic/otra", "/queue/eventos-user123", "/topic/game/abc",
                "/topic/game/ABCDEFGHIJ", "/user/queue/otra" }) {
            try (RawStompClient spy = RawStompClient.connect(port, ORIGIN)) {
                spy.subscribe(destination);
                assertTrue(spy.awaitClosed(2000), "deberia rechazarse " + destination);
            }
        }
    }

    @Test
    @DisplayName("publicar directo en /topic/game/{sala} (estado falso a los jugadores) no llega a nadie")
    void cannotPublishToBrokerTopic() throws Exception {
        try (RawStompClient victim = victima("FALS01"); RawStompClient attacker = RawStompClient.connect(port, ORIGIN)) {
            attacker.send("/topic/game/FALS01", "{\"lastEvent\":{\"type\":\"VICTORY\",\"reason\":\"FALSIFICADO\"}}");
            Thread.sleep(700);
            assertTrue(victim.messages().stream().noneMatch(f -> f.body().contains("FALSIFICADO")),
                    "la victima recibio un estado falsificado");
            assertTrue(attacker.awaitClosed(2000), "mandar fuera de /app/game/ corta la conexion");
        }
    }

    @Test
    @DisplayName("una conexion no puede abrir suscripciones sin limite")
    void subscriptionsAreCapped() throws Exception {
        try (RawStompClient spy = RawStompClient.connect(port, ORIGIN)) {
            for (int i = 0; i < 20; i++) {
                spy.subscribe("/topic/game/SUB" + String.format("%03d", i));
            }
            assertTrue(spy.awaitClosed(2000), "deberia cortarse al pasar el tope de suscripciones");
        }
    }

    @Test
    @DisplayName("inundar de mensajes se descarta (rate_limit) y si sigue, se corta la conexion")
    void floodIsRateLimited() throws Exception {
        try (RawStompClient victim = victima("SPAM01")) {
            double before = rejected("rate_limit");
            for (int i = 0; i < 600; i++) {
                victim.send("/app/game/SPAM01/ping", "{\"playerId\":\"SEGURIDAD\",\"kind\":\"HELP\"}");
            }
            assertTrue(victim.awaitClosed(3000), "deberia desconectarse tras abusar");
            assertTrue(rejected("rate_limit") > before + 50, "deberia contar los descartes");
        }
    }

    @Test
    @DisplayName("el ritmo normal del cliente (movimiento a 10 Hz y acciones sueltas) no se corta")
    void normalClientIsNotLimited() throws Exception {
        try (RawStompClient victim = victima("NORM01")) {
            double before = rejected("rate_limit");
            for (int i = 0; i < 40; i++) {
                victim.send("/app/game/NORM01/move", "{\"playerId\":\"SEGURIDAD\",\"floor\":1,\"x\":608,\"y\":800}");
                if (i % 5 == 0) {
                    victim.send("/app/game/NORM01/ping", "{\"playerId\":\"SEGURIDAD\",\"kind\":\"GO\"}");
                }
                Thread.sleep(100);
            }
            assertFalse(victim.isClosed(), "un cliente normal no deberia desconectarse");
            assertTrue(rejected("rate_limit") == before, "no deberia descartarse nada");
        }
    }

    @Test
    @DisplayName("un frame de 20 KB (token o cuerpo gigante) corta la conexion")
    void oversizedFrameIsRejected() throws Exception {
        try (RawStompClient attacker = RawStompClient.connect(port, ORIGIN)) {
            String token = "a".repeat(20_000);
            attacker.send("/app/game/GRAN01/rejoin",
                    "{\"role\":\"SEGURIDAD\",\"clientId\":\"x\",\"token\":\"" + token + "\"}");
            assertTrue(attacker.awaitClosed(3000), "deberia cerrarse por tamano");
        }
    }

    @Test
    @DisplayName("una conexion que no manda nada se cierra (time to first message)")
    void idleConnectionIsClosed() throws Exception {
        AtomicBoolean closed = new AtomicBoolean();
        WebSocket socket = HttpClient.newHttpClient().newWebSocketBuilder()
                .header("Origin", ORIGIN)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), new WebSocket.Listener() {
                    @Override
                    public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
                        closed.set(true);
                        return null;
                    }

                    @Override
                    public void onError(WebSocket webSocket, Throwable error) {
                        closed.set(true);
                    }
                }).get(5, TimeUnit.SECONDS);
        long until = System.currentTimeMillis() + 5000;
        while (!closed.get() && System.currentTimeMillis() < until) {
            Thread.sleep(50);
        }
        socket.abort();
        assertTrue(closed.get(), "la conexion muda deberia cerrarse");
    }

    @Test
    @DisplayName("el handshake desde otro sitio (Origin ajeno) se rechaza")
    void foreignOriginIsRejected() {
        Exception error = null;
        try (RawStompClient ignored = RawStompClient.connect(port, "https://atacante.example")) {
            // conecto: mal
        } catch (Exception ex) {
            error = ex;
        }
        assertNotNull(error, "el handshake deberia fallar");
    }
}
