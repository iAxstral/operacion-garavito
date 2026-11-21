package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.GameSession;
import co.eci.operaciongaravito.game.GameSessionService;
import co.eci.operaciongaravito.game.PlayerState;
import co.eci.operaciongaravito.game.Zombie;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Cuerpos maliciosos por STOMP: null, JSON roto, NaN/Infinity en coordenadas, ids y
 * tokens con formato invalido. El servidor debe rechazarlos sin romperse.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@TestPropertySource(properties = "app.websocket.allowed-origins=http://localhost")
class EntradaSecurityTest {

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

    private RawStompClient sentado(String code, String role, String token) throws Exception {
        if (sessions.find(code) == null) {
            sessions.create(code, Building.F);
        }
        RawStompClient client = RawStompClient.connect(port, ORIGIN);
        client.subscribe("/user/queue/eventos");
        client.subscribe("/topic/game/" + code);
        Thread.sleep(150);
        client.send("/app/game/" + code + "/join",
                "{\"role\":\"" + role + "\",\"clientId\":\"c" + role + "\",\"token\":\"" + token + "\",\"name\":\"N\"}");
        assertNotNull(client.awaitBody("JOIN_OK", 3000), "deberia entrar " + role);
        return client;
    }

    private PlayerState estado(String code, String role) {
        GameSession session = sessions.find(code);
        synchronized (session) {
            return session.playerStates().stream().filter(p -> p.playerId().equals(role)).findFirst().orElseThrow();
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Zombie> zombies(GameSession session) throws Exception {
        java.lang.reflect.Field field = GameSession.class.getDeclaredField("zombies");
        field.setAccessible(true);
        return (Map<String, Zombie>) field.get(session);
    }

    @Test
    @DisplayName("un ataque con x/y/facing = \"NaN\" no golpea a todos los zombis del piso")
    void nanAttackDoesNotHitEverything() throws Exception {
        try (RawStompClient client = sentado("NAN001", "SEGURIDAD", "token-seguridad-nan-0001")) {
            client.send("/app/game/NAN001/start", "{\"playerId\":\"SEGURIDAD\"}");
            Thread.sleep(400);
            GameSession session = sessions.find("NAN001");
            assertTrue(session.isStarted());
            PlayerState me = estado("NAN001", "SEGURIDAD");
            // Zombis lejos (fuera del alcance de los punos) y a la espalda.
            Map<String, Zombie> zombies = zombies(session);
            synchronized (session) {
                for (int i = 0; i < 6; i++) {
                    zombies.put("zn" + i, new Zombie("zn" + i, me.floor(), me.x() + 400 + i * 40, me.y() - 300, 1, 1));
                }
            }
            double before = rejected("bad_payload");
            client.send("/app/game/NAN001/attack", "{\"playerId\":\"SEGURIDAD\",\"type\":\"BASIC\",\"x\":\"NaN\",\"y\":\"NaN\",\"facing\":\"NaN\"}");
            client.send("/app/game/NAN001/attack", "{\"playerId\":\"SEGURIDAD\",\"type\":\"BASIC\",\"x\":" + me.x() + ",\"y\":" + me.y() + ",\"facing\":\"Infinity\"}");
            Thread.sleep(800);
            long alive = zombies.values().stream().filter(Zombie::isAlive).count();
            assertEquals(6, alive, "ningun zombi lejano deberia morir");
            assertTrue(rejected("bad_payload") >= before + 2, "las coordenadas no finitas se rechazan");
        }
    }

    @Test
    @DisplayName("un movimiento a NaN o Infinity no cambia la posicion del jugador")
    void nanMoveIsRejected() throws Exception {
        try (RawStompClient client = sentado("NAN002", "SEGURIDAD", "token-seguridad-nan-0002")) {
            PlayerState before = estado("NAN002", "SEGURIDAD");
            client.send("/app/game/NAN002/move", "{\"playerId\":\"SEGURIDAD\",\"floor\":1,\"x\":\"NaN\",\"y\":\"Infinity\"}");
            client.send("/app/game/NAN002/move", "{\"playerId\":\"SEGURIDAD\",\"floor\":1,\"x\":1e400,\"y\":-1e400}");
            Thread.sleep(500);
            PlayerState after = estado("NAN002", "SEGURIDAD");
            assertEquals(before.x(), after.x());
            assertEquals(before.y(), after.y());
        }
    }

    @Test
    @DisplayName("cuerpos null, vacios o JSON roto se rechazan sin tumbar la conexion ni el servidor")
    void brokenBodiesAreRejected() throws Exception {
        try (RawStompClient client = sentado("ROTO01", "SEGURIDAD", "token-seguridad-roto-001")) {
            double before = rejected("bad_payload");
            for (String dest : new String[] { "move", "attack", "join", "lobby", "transfer", "purchase", "chat" }) {
                client.send("/app/game/ROTO01/" + dest, "null");
                client.send("/app/game/ROTO01/" + dest, "{esto no es json");
                client.send("/app/game/ROTO01/" + dest, "");
            }
            Thread.sleep(800);
            assertFalse(client.isClosed(), "un cuerpo roto no deberia cortar al jugador");
            assertTrue(rejected("bad_payload") >= before + 14, "rechazos: " + (rejected("bad_payload") - before));
            // Y sigue jugando normal.
            client.send("/app/game/ROTO01/ping", "{\"playerId\":\"SEGURIDAD\",\"kind\":\"GO\"}");
            assertNotNull(client.awaitBody("\"type\":\"PING\"", 2000));
        }
    }

    @Test
    @DisplayName("ids, frases y nombres con formato invalido o gigantes se rechazan")
    void badIdentifiersAreRejected() throws Exception {
        try (RawStompClient client = sentado("IDS001", "SEGURIDAD", "token-seguridad-ids-0001")) {
            double before = rejected("bad_payload");
            String huge = "x".repeat(2000);
            client.send("/app/game/IDS001/use", "{\"playerId\":\"SEGURIDAD\",\"itemId\":\"" + huge + "\"}");
            client.send("/app/game/IDS001/equip", "{\"playerId\":\"SEGURIDAD\",\"itemId\":\"../../etc\"}");
            client.send("/app/game/IDS001/chat", "{\"playerId\":\"SEGURIDAD\",\"phrase\":\"<script>\"}");
            client.send("/app/game/IDS001/transfer", "{\"playerId\":\"SEGURIDAD\",\"targetId\":\"" + huge + "\",\"amount\":1}");
            client.send("/app/game/IDS001/door/toggle", "{\"playerId\":\"SEGURIDAD\",\"doorId\":\"DROP TABLE\",\"x\":0,\"y\":0}");
            Thread.sleep(600);
            assertTrue(rejected("bad_payload") >= before + 5, "rechazos: " + (rejected("bad_payload") - before));
        }
    }

    @Test
    @DisplayName("un token de reconexion con formato invalido se rechaza (bad_token) y el correcto funciona")
    void badTokensAreRejected() throws Exception {
        sessions.create("TOKN01", Building.F);
        double before = rejected("bad_token");
        try (RawStompClient client = RawStompClient.connect(port, ORIGIN)) {
            client.subscribe("/user/queue/eventos");
            client.subscribe("/topic/game/TOKN01");
            Thread.sleep(150);
            client.send("/app/game/TOKN01/join", "{\"role\":\"SALUD\",\"clientId\":\"corto\",\"token\":\"abc\"}");
            client.send("/app/game/TOKN01/join", "{\"role\":\"SALUD\",\"clientId\":\"raro\",\"token\":\"tok%en;con$simbolos!!\"}");
            Thread.sleep(600);
            assertNull(sessions.find("TOKN01").playerStates().stream().filter(p -> p.playerId().equals("SALUD")).findFirst().orElse(null),
                    "con un token invalido no entra");
            assertTrue(rejected("bad_token") >= before + 2);
        }
        try (RawStompClient ok = sentado("TOKN01", "SALUD", "0f6a3b2c-1d4e-4f5a-9b8c-7d6e5f4a3b2c")) {
            assertFalse(ok.isClosed());
        }
    }
}
