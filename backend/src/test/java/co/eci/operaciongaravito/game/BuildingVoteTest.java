package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BuildingVoteTest {

    private static final List<String> ROLES = List.of("SEGURIDAD", "SALUD", "ECONOMIA", "INFRAESTRUCTURA");

    private GameSession session;

    @BeforeEach
    void setUp() {
        session = new GameSession("VOTA", Building.F, BossConfig.defaults());
        ROLES.forEach(session::joinPlayer);
    }

    @Test
    @DisplayName("gana el edificio con mas votos y la partida se arma con su mapa")
    void majorityWins() {
        assertNull(session.voteBuilding("SEGURIDAD", "B"));
        assertNull(session.voteBuilding("SALUD", "B"));
        assertNull(session.voteBuilding("ECONOMIA", "biblioteca"));

        assertEquals(Building.B, session.lobbyState().leading());
        assertTrue(session.start("SEGURIDAD"));
        assertEquals(Building.B, session.getBuilding());
        assertEquals(Building.B, session.lobbyState().building());
    }

    @Test
    @DisplayName("cambiar el voto reemplaza el anterior: cada jugador cuenta una vez")
    void changingVoteReplacesIt() {
        session.voteBuilding("SALUD", "C");
        session.voteBuilding("SALUD", "G");
        session.voteBuilding("SALUD", "A");

        assertEquals(Map.of("SALUD", "A"), session.lobbyState().votes());
    }

    @Test
    @DisplayName("el voto de quien se va de la sala deja de contar")
    void leavingPlayerVoteIsDropped() {
        session.voteBuilding("SALUD", "G");
        session.voteBuilding("ECONOMIA", "G");
        session.voteBuilding("INFRAESTRUCTURA", "A");
        session.removePlayer("SALUD");
        session.removePlayer("ECONOMIA");

        assertEquals(Building.A, session.lobbyState().leading());
    }

    @Test
    @DisplayName("empate: decide el voto del anfitrion; si no voto, el primero del mapa")
    void tieBreaks() {
        session.voteBuilding("SALUD", "A");
        session.voteBuilding("ECONOMIA", "G");
        assertEquals(Building.G, session.lobbyState().leading(), "sin voto del anfitrion, el primero en orden");

        session.voteBuilding("SEGURIDAD", "A");
        session.voteBuilding("INFRAESTRUCTURA", "G");
        assertEquals(Building.A, session.lobbyState().leading(), "2 a 2: gana el del anfitrion");
    }

    @Test
    @DisplayName("sin votos se juega el edificio con el que se creo la sala")
    void noVotesKeepsBuilding() {
        session.start("SEGURIDAD");
        assertEquals(Building.F, session.getBuilding());
    }

    @Test
    @DisplayName("no se vota con la partida empezada, ni un edificio que no existe, ni sin estar en la sala")
    void rejections() {
        assertEquals("invalid_building", session.voteBuilding("SALUD", "Z"));
        assertEquals("unknown_player", session.voteBuilding("FANTASMA", "B"));
        session.start("SEGURIDAD");
        assertEquals("already_started", session.voteBuilding("SALUD", "B"));
        assertEquals(Building.F, session.getBuilding());
    }

    @Test
    @DisplayName("votos de muchos hilos mientras el anfitrion empieza: cada voto cuenta entero o se rechaza")
    void concurrentVotesAndStart() throws InterruptedException {
        Building[] options = Building.values();
        int threads = 32;
        int votesPerThread = 200;
        ExecutorService pool = Executors.newFixedThreadPool(threads + 1);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger accepted = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();

        for (int t = 0; t < threads; t++) {
            String role = ROLES.get(t % ROLES.size());
            int seed = t;
            pool.submit(() -> {
                go.await();
                for (int i = 0; i < votesPerThread; i++) {
                    String reason = session.voteBuilding(role, options[(seed + i) % options.length].name());
                    if (reason == null) {
                        accepted.incrementAndGet();
                    } else {
                        assertEquals("already_started", reason);
                        rejected.incrementAndGet();
                    }
                }
                return null;
            });
        }
        pool.submit(() -> {
            go.await();
            Thread.sleep(2);
            session.start("SEGURIDAD");
            return null;
        });
        go.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));

        assertEquals(threads * votesPerThread, accepted.get() + rejected.get());
        // Despues de empezar ningun voto entra: los que quedaron son los que se contaron.
        Map<String, String> counted = session.lobbyState().votes();
        assertTrue(counted.size() <= ROLES.size(), "un voto por jugador");
        BuildingVote recount = new BuildingVote();
        counted.forEach((role, building) -> recount.vote(role, Building.valueOf(building)));
        assertEquals(recount.winner(ROLES, "SEGURIDAD", Building.F), session.getBuilding());
    }
}
