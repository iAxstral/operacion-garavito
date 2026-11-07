package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.GameSession;
import co.eci.operaciongaravito.game.GameSessionService;
import co.eci.operaciongaravito.game.PlayerState;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Trampas y abuso desde un cliente con script, contra el servidor real: actuar a nombre
 * de otro, actuar sin sentarse, robar un puesto, moverse imposible, plata negativa,
 * miles de salas, tokens gigantes y muchas conexiones desde la misma IP.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@TestPropertySource(properties = {
        "app.websocket.allowed-origins=http://localhost",
        "security.rooms.max-per-node=50",
        "security.ws.max-connections-per-ip=6",
})
class JuegoSecurityTest {

    static final String ORIGIN = "http://localhost";

    @LocalServerPort
    int port;

    @Autowired
    GameSessionService sessions;

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
            return session.playerStates().stream().filter(p -> p.playerId().equals(role)).findFirst().orElse(null);
        }
    }

    @Test
    @DisplayName("mandar acciones con el playerId de otro jugador no lo mueve, no lo saca ni le gasta la plata")
    void spoofedPlayerIdIsIgnored() throws Exception {
        try (RawStompClient victim = sentado("SUPL01", "ECONOMIA", "token-economia-victima-01");
                RawStompClient attacker = sentado("SUPL01", "SEGURIDAD", "token-seguridad-atacante1")) {
            sessions.find("SUPL01").getOrCreatePlayer("ECONOMIA").addGaravitos(50);
            PlayerState before = estado("SUPL01", "ECONOMIA");
            attacker.send("/app/game/SUPL01/move", "{\"playerId\":\"ECONOMIA\",\"floor\":1,\"x\":" + (before.x() + 30) + ",\"y\":" + before.y() + "}");
            attacker.send("/app/game/SUPL01/transfer", "{\"playerId\":\"ECONOMIA\",\"targetId\":\"SEGURIDAD\",\"amount\":50}");
            attacker.send("/app/game/SUPL01/leave", "{\"playerId\":\"ECONOMIA\"}");
            Thread.sleep(600);
            PlayerState after = estado("SUPL01", "ECONOMIA");
            assertNotNull(after, "la victima sigue en la sala");
            assertEquals(before.x(), after.x());
            assertEquals(50, after.garavitos(), "no le gastaron la plata");
        }
    }

    @Test
    @DisplayName("acciones de una conexion que nunca se sento se ignoran")
    void actionsWithoutJoinAreIgnored() throws Exception {
        try (RawStompClient victim = sentado("SINJ01", "SEGURIDAD", "token-seguridad-sinjoin1");
                RawStompClient ghost = RawStompClient.connect(port, ORIGIN)) {
            ghost.send("/app/game/SINJ01/start", "{\"playerId\":\"SEGURIDAD\"}");
            ghost.send("/app/game/SINJ01/purchase", "{\"playerId\":\"SEGURIDAD\",\"itemId\":\"shop-arepa\",\"x\":0,\"y\":0}");
            ghost.send("/app/game/SINJ01/leave", "{\"playerId\":\"SEGURIDAD\"}");
            Thread.sleep(600);
            assertFalse(sessions.find("SINJ01").isStarted(), "un fantasma no puede iniciar la partida");
            assertNotNull(estado("SINJ01", "SEGURIDAD"), "ni sacar a nadie");
        }
    }

    @Test
    @DisplayName("un rol ya tomado no se puede ocupar, y el rechazo llega solo a quien lo intento")
    void takenRoleIsRejected() throws Exception {
        try (RawStompClient owner = sentado("ROLE01", "SALUD", "token-salud-dueno-000001");
                RawStompClient thief = RawStompClient.connect(port, ORIGIN)) {
            thief.subscribe("/user/queue/eventos");
            thief.subscribe("/topic/game/ROLE01");
            Thread.sleep(150);
            thief.send("/app/game/ROLE01/join", "{\"role\":\"SALUD\",\"clientId\":\"ladron\",\"token\":\"token-del-ladron-0000001\"}");
            assertNotNull(thief.await(f -> f.body().contains("role_taken") && f.header("destination").startsWith("/user/queue/"), 3000));
            Thread.sleep(200);
            assertTrue(owner.messages().stream().noneMatch(f -> f.body().contains("ladron")), "el dueno no ve el intento");
        }
    }

    @Test
    @DisplayName("volver a un puesto con un token valido pero equivocado no funciona")
    void rejoinWithWrongTokenFails() throws Exception {
        RawStompClient owner = sentado("REJO01", "SALUD", "token-salud-verdadero-01");
        owner.close(); // se cae: el puesto queda guardado para su token
        Thread.sleep(400);
        try (RawStompClient thief = RawStompClient.connect(port, ORIGIN)) {
            thief.subscribe("/user/queue/eventos");
            Thread.sleep(150);
            thief.send("/app/game/REJO01/rejoin", "{\"role\":\"SALUD\",\"clientId\":\"ladron\",\"token\":\"token-salud-adivinado-01\"}");
            assertNotNull(thief.awaitBody("bad_token", 3000));
        }
        try (RawStompClient back = RawStompClient.connect(port, ORIGIN)) {
            back.subscribe("/user/queue/eventos");
            back.subscribe("/topic/game/REJO01");
            Thread.sleep(150);
            back.send("/app/game/REJO01/rejoin", "{\"role\":\"SALUD\",\"clientId\":\"dueno\",\"token\":\"token-salud-verdadero-01\"}");
            assertNotNull(back.awaitBody("REJOIN_OK", 3000), "el dueno con su token si vuelve");
        }
    }

    @Test
    @DisplayName("speedhack: un salto de 1500 px se corrige y el servidor deja al jugador donde estaba")
    void speedhackIsCorrected() throws Exception {
        try (RawStompClient client = sentado("VELO01", "SEGURIDAD", "token-seguridad-veloz-001")) {
            client.send("/app/game/VELO01/start", "{\"playerId\":\"SEGURIDAD\"}");
            Thread.sleep(300);
            PlayerState before = estado("VELO01", "SEGURIDAD");
            client.send("/app/game/VELO01/move", "{\"playerId\":\"SEGURIDAD\",\"floor\":1,\"x\":" + (before.x() + 1500) + ",\"y\":" + before.y() + "}");
            assertNotNull(client.awaitBody("POSITION_CORRECTED", 2000));
            assertEquals(before.x(), estado("VELO01", "SEGURIDAD").x());
        }
    }

    @Test
    @DisplayName("transferencias negativas, de cero o mayores al saldo no mueven plata")
    void negativeTransferIsRejected() throws Exception {
        try (RawStompClient eco = sentado("PLAT01", "ECONOMIA", "token-economia-plata-001");
                RawStompClient seg = sentado("PLAT01", "SEGURIDAD", "token-seguridad-plata-01")) {
            sessions.find("PLAT01").getOrCreatePlayer("ECONOMIA").addGaravitos(30);
            for (String amount : new String[] { "-500", "0", "999999", "-2147483648", "2147483647" }) {
                eco.send("/app/game/PLAT01/transfer", "{\"playerId\":\"ECONOMIA\",\"targetId\":\"SEGURIDAD\",\"amount\":" + amount + "}");
            }
            Thread.sleep(700);
            assertEquals(30, estado("PLAT01", "ECONOMIA").garavitos());
            assertEquals(0, estado("PLAT01", "SEGURIDAD").garavitos());
        }
    }

    @Test
    @DisplayName("miles de pedidos de sala: el nodo no pasa su tope y sigue respondiendo")
    void thousandsOfCreatesAreCapped() throws Exception {
        List<RawStompClient> clients = new ArrayList<>();
        try {
            for (int c = 0; c < 4; c++) {
                RawStompClient client = RawStompClient.connect(port, ORIGIN);
                client.subscribe("/user/queue/eventos");
                clients.add(client);
            }
            Thread.sleep(150);
            for (int i = 0; i < 2000; i++) {
                clients.get(i % clients.size()).send("/app/game/create", "{\"clientId\":\"miles" + i + "\",\"building\":\"F\"}");
            }
            Thread.sleep(1500);
            assertTrue(sessions.estado().salas() <= 50, "salas: " + sessions.estado().salas());
            // El servidor sigue atendiendo a alguien normal.
            try (RawStompClient normal = sentado("NORM02", "SALUD", "token-salud-normal-00001")) {
                assertFalse(normal.isClosed());
            }
        } finally {
            clients.forEach(RawStompClient::close);
        }
    }

    @Test
    @DisplayName("un token de 60 KB ni siquiera llega a procesarse: se corta la conexion")
    void hugeTokenIsRejected() throws Exception {
        sessions.create("GRAN02", Building.F);
        try (RawStompClient attacker = RawStompClient.connect(port, ORIGIN)) {
            attacker.send("/app/game/GRAN02/join",
                    "{\"role\":\"SALUD\",\"clientId\":\"x\",\"token\":\"" + "t".repeat(60_000) + "\"}");
            assertTrue(attacker.awaitClosed(3000));
            assertEquals(0, sessions.find("GRAN02").playerCount());
        }
    }

    @Test
    @DisplayName("suscribirse a una sala ajena sin conocer su codigo no recibe nada")
    void unknownRoomSubscriptionGetsNothing() throws Exception {
        try (RawStompClient victim = sentado("AJEN01", "SALUD", "token-salud-ajena-000001");
                RawStompClient spy = RawStompClient.connect(port, ORIGIN)) {
            spy.subscribe("/topic/game/AJEN02");
            Thread.sleep(200);
            victim.send("/app/game/AJEN01/ping", "{\"playerId\":\"SALUD\",\"kind\":\"HELP\"}");
            Thread.sleep(500);
            assertTrue(spy.messages().isEmpty());
        }
    }

    @Test
    @DisplayName("una misma IP no puede abrir conexiones sin limite (adivinar codigos en paralelo)")
    void connectionsPerIpAreCapped() throws Exception {
        List<RawStompClient> clients = new ArrayList<>();
        int open = 0;
        try {
            for (int i = 0; i < 10; i++) {
                try {
                    clients.add(RawStompClient.connect(port, ORIGIN));
                } catch (Exception ex) {
                    // rechazada al conectar: tambien cuenta como cortada
                }
            }
            Thread.sleep(500);
            for (RawStompClient client : clients) {
                if (!client.isClosed()) {
                    open++;
                }
            }
            assertEquals(6, open, "solo 6 conexiones por IP");
        } finally {
            clients.forEach(RawStompClient::close);
        }
    }
}
