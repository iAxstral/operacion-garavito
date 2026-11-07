package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.GameSessionService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Abuso de salas: crear miles, dejar salas vacias para siempre, elegir o adivinar el
 * codigo, confirmar que un codigo existe por los rechazos y acaparar puestos.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@TestPropertySource(properties = {
        "app.websocket.allowed-origins=http://localhost",
        "security.rooms.max-per-connection=3",
        "security.rooms.max-per-ip=5",
        "security.rooms.max-per-node=8",
        "security.rooms.empty-ttl-ms=400",
        "security.rooms.client-codes-allowed=false",
})
class SalasSecurityTest {

    static final String ORIGIN = "http://localhost";
    static final Pattern CREATED = Pattern.compile("\"type\":\"LOBBY_CREATED\"[^}]*\"itemId\":\"([A-Z0-9]+)\"");

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

    private static RawStompClient conPrivada(int port) throws Exception {
        RawStompClient client = RawStompClient.connect(port, ORIGIN);
        client.subscribe("/user/queue/eventos");
        Thread.sleep(100);
        return client;
    }

    private static String crear(RawStompClient client, String clientId) throws InterruptedException {
        client.send("/app/game/create", "{\"clientId\":\"" + clientId + "\",\"building\":\"F\",\"mode\":\"NORMAL\"}");
        RawStompClient.Frame frame = client.await(f -> "MESSAGE".equals(f.command())
                && f.body().contains(clientId) && (f.body().contains("LOBBY_CREATED") || f.body().contains("LOBBY_REJECTED")), 3000);
        if (frame == null) {
            return null;
        }
        Matcher m = CREATED.matcher(frame.body());
        return m.find() ? m.group(1) : null;
    }

    @Test
    @DisplayName("el servidor genera el codigo (6+ caracteres, al azar) y lo responde solo a quien creo la sala")
    void serverGeneratesTheCode() throws Exception {
        Set<String> codes = new HashSet<>();
        try (RawStompClient a = conPrivada(port); RawStompClient b = conPrivada(port)) {
            String one = crear(a, "creador-a");
            String two = crear(b, "creador-b");
            assertNotNull(one, "deberia llegar LOBBY_CREATED por la cola privada");
            assertNotNull(two);
            codes.add(one);
            codes.add(two);
            assertEquals(2, codes.size());
            assertTrue(one.matches("[A-Z0-9]{6,8}"), "codigo: " + one);
            assertNotNull(sessions.find(one));
            assertTrue(b.messages().stream().noneMatch(f -> f.body().contains(one)), "el otro no deberia ver el codigo ajeno");
        }
    }

    @Test
    @DisplayName("el cliente ya no puede elegir el codigo de la sala (create=true con su propio codigo)")
    void clientCannotPickTheCode() throws Exception {
        try (RawStompClient a = conPrivada(port)) {
            a.subscribe("/topic/game/ELEGI1");
            Thread.sleep(100);
            a.send("/app/game/ELEGI1/lobby", "{\"clientId\":\"elige\",\"create\":true,\"building\":\"F\"}");
            Thread.sleep(600);
            assertNull(sessions.find("ELEGI1"), "no deberia crearse la sala con el codigo del cliente");
        }
    }

    @Test
    @DisplayName("una conexion no puede crear salas sin limite (tope por conexion)")
    void roomsPerConnectionAreCapped() throws Exception {
        double before = rejected("room_cap");
        try (RawStompClient a = conPrivada(port)) {
            int created = 0;
            for (int i = 0; i < 10; i++) {
                if (crear(a, "flood" + i) != null) {
                    created++;
                }
            }
            assertEquals(3, created, "solo 3 salas por conexion");
            assertTrue(rejected("room_cap") >= before + 7);
        }
    }

    @Test
    @DisplayName("varias conexiones desde la misma IP tampoco pasan el tope por IP")
    void roomsPerIpAreCapped() throws Exception {
        int created = 0;
        for (int c = 0; c < 4; c++) {
            try (RawStompClient a = conPrivada(port)) {
                for (int i = 0; i < 3; i++) {
                    if (crear(a, "ip" + c + "x" + i) != null) {
                        created++;
                    }
                }
            }
        }
        assertEquals(5, created, "solo 5 salas por IP en la ventana");
    }

    @Test
    @DisplayName("el nodo tiene un tope total de salas")
    void roomsPerNodeAreCapped() throws Exception {
        for (int i = 0; i < 12; i++) {
            sessions.create(String.format("NODO%02d", i), Building.F);
        }
        assertTrue(sessions.estado().salas() <= 8, "salas: " + sessions.estado().salas());
    }

    @Test
    @DisplayName("una sala sin jugadores se borra sola y no deja su tarea programada")
    void emptyRoomExpires() throws Exception {
        int tasksBefore = sessions.scheduledTasks();
        for (int i = 0; i < 5; i++) {
            sessions.create(String.format("VACI%02d", i), Building.F);
        }
        assertEquals(tasksBefore + 5, sessions.scheduledTasks());
        Thread.sleep(1500);
        for (int i = 0; i < 5; i++) {
            assertNull(sessions.find(String.format("VACI%02d", i)), "la sala vacia deberia haberse borrado");
        }
        assertEquals(tasksBefore, sessions.scheduledTasks(), "no deberia quedar el tick de la sala");
    }

    @Test
    @DisplayName("los rechazos (sala no existe) van solo a quien pregunto, no al topic de la sala")
    void rejectionsArePrivate() throws Exception {
        try (RawStompClient prober = conPrivada(port); RawStompClient listener = RawStompClient.connect(port, ORIGIN)) {
            listener.subscribe("/topic/game/NOEXIS");
            prober.subscribe("/topic/game/NOEXIS");
            Thread.sleep(150);
            prober.send("/app/game/NOEXIS/lobby", "{\"clientId\":\"sonda-1\",\"create\":false,\"building\":\"F\"}");
            assertNotNull(prober.await(f -> f.body().contains("LOBBY_REJECTED") && f.body().contains("sonda-1")
                    && f.header("destination") != null && f.header("destination").startsWith("/user/queue/"), 3000),
                    "el que pregunto recibe el rechazo por su cola privada");
            Thread.sleep(300);
            assertTrue(listener.messages().isEmpty(), "en el topic no se publica nada: no filtra el clientId");
        }
    }

    @Test
    @DisplayName("una conexion solo puede ocupar un puesto (no acapara la sala)")
    void oneSeatPerConnection() throws Exception {
        sessions.create("ASIE01", Building.F);
        try (RawStompClient a = conPrivada(port)) {
            a.subscribe("/topic/game/ASIE01");
            Thread.sleep(150);
            for (String role : new String[] { "SEGURIDAD", "SALUD", "ECONOMIA", "INFRAESTRUCTURA" }) {
                a.send("/app/game/ASIE01/join", "{\"role\":\"" + role + "\",\"clientId\":\"acapara\",\"token\":\"token-acaparador-" + role + "\"}");
            }
            Thread.sleep(800);
            assertEquals(1, sessions.find("ASIE01").playerCount(), "solo un puesto por conexion");
        }
    }
}
