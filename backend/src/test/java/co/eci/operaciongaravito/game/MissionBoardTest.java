package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.random.RandomGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MissionBoardTest {

    private MissionBoard board;
    private Player guard;
    private Player medic;
    private List<Player> team;

    @BeforeEach
    void setUp() {
        board = new MissionBoard(Building.F, RandomGenerator.of("L64X128MixRandom"));
        guard = new Player("SEGURIDAD");
        medic = new Player("SALUD");
        team = List.of(guard, medic);
        board.deal(1, team);
    }

    private void completeAll(Player player) {
        board.viewFor(player.getPlayerId()).forEach(m -> board.complete(player.getPlayerId(), m.missionId()));
    }

    @Test
    @DisplayName("cada jugador recibe 3 misiones distintas de su rol, en 3 salas distintas")
    void dealsThreeMissionsOfTheRole() {
        List<MissionView> missions = board.viewFor("SEGURIDAD");
        assertEquals(MissionBoard.MISSIONS_PER_KINDER, missions.size());
        assertTrue(missions.stream().allMatch(m -> m.type().role() == Role.SEGURIDAD));
        assertEquals(3, missions.stream().map(MissionView::siteId).distinct().count());
        assertEquals(3, missions.stream().map(MissionView::type).distinct().count(), "no repite minijuego en el Kinder");
    }

    @Test
    @DisplayName("cada rol tiene cuatro minijuegos y el que falto en un Kinder aparece en el siguiente")
    void missionTypesRotate() {
        for (Role role : Role.values()) {
            assertEquals(4, MissionType.forRole(role).size(), role.name());
        }
        for (int kinder = 2; kinder <= 6; kinder++) {
            Set<MissionType> before = new HashSet<>();
            board.viewFor("SEGURIDAD").forEach(m -> before.add(m.type()));
            Set<MissionType> missing = new HashSet<>(MissionType.forRole(Role.SEGURIDAD));
            missing.removeAll(before);
            board.deal(kinder, team);
            Set<MissionType> now = new HashSet<>();
            board.viewFor("SEGURIDAD").forEach(m -> now.add(m.type()));
            assertTrue(now.containsAll(missing), "Kinder " + kinder + ": faltaba " + missing + " y salio " + now);
        }
    }

    @Test
    @DisplayName("el siguiente Kinder trae salas distintas a las del anterior")
    void sitesRotateBetweenKinders() {
        Set<String> first = new HashSet<>();
        board.viewFor("SEGURIDAD").forEach(m -> first.add(m.siteId()));
        board.deal(2, team);
        board.viewFor("SEGURIDAD").forEach(m -> assertFalse(first.contains(m.siteId()),
                "repitio la sala " + m.siteId()));
    }

    @Test
    @DisplayName("la recompensa sube con el Kinder")
    void rewardGrowsWithTheKinder() {
        assertEquals(MissionCatalog.REWARD_GARAVITOS, board.viewFor("SALUD").get(0).reward());
        board.deal(4, team);
        assertEquals(MissionCatalog.rewardFor(4), board.viewFor("SALUD").get(0).reward());
        assertTrue(MissionCatalog.rewardFor(4) > MissionCatalog.REWARD_GARAVITOS);
    }

    @Test
    @DisplayName("la barrera se abre solo cuando todos los vivos completaron sus misiones")
    void barrierWaitsForEveryone() {
        assertFalse(board.allDone(team));
        completeAll(guard);
        assertFalse(board.allDone(team), "falta Biomedica");
        completeAll(medic);
        assertTrue(board.allDone(team));
    }

    @Test
    @DisplayName("un caido no traba la barrera")
    void downedPlayersDoNotBlock() {
        completeAll(guard);
        while (medic.isAlive()) {
            medic.takeDamage(50);
        }
        assertTrue(board.allDone(team));
    }

    @Test
    @DisplayName("una mision no se puede cobrar dos veces ni completar la de otro")
    void missionsPayOnce() {
        String id = board.viewFor("SEGURIDAD").get(0).missionId();
        assertNull(board.pending("SALUD", id), "no es suya");
        assertTrue(board.complete("SEGURIDAD", id));
        assertFalse(board.complete("SEGURIDAD", id));
        assertNull(board.pending("SEGURIDAD", id));
        assertEquals(1, board.completed("SEGURIDAD"));
    }

    @Test
    @DisplayName("completar la misma mision desde muchos hilos la paga una sola vez")
    void concurrentCompletionPaysOnce() throws InterruptedException {
        String id = board.viewFor("SEGURIDAD").get(0).missionId();
        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger paid = new AtomicInteger();
        for (int i = 0; i < 32; i++) {
            pool.submit(() -> {
                start.await();
                if (board.complete("SEGURIDAD", id)) {
                    paid.incrementAndGet();
                }
                return null;
            });
        }
        start.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS));
        assertEquals(1, paid.get());
    }

    @Test
    @DisplayName("el Kinder no se pasa con la cuota si faltan misiones, y si cuando estan")
    void kinderNeedsQuotaAndMissions() {
        WaveDirector director = new WaveDirector(0, 0, List.of(
                FloorGrid.forFloor(Building.F, 1), FloorGrid.forFloor(Building.F, 2), FloorGrid.forFloor(Building.F, 3)));
        guard.reportPosition(1, 608, 800);
        director.update(1, 0, team, false);
        director.onZombiesKilled(WaveCurve.blueprint(1).killQuota());

        director.update(2, 0, team, false);
        assertFalse(director.consumeJustCleared(), "faltan misiones");
        assertTrue(director.state(2).waitingForMissions());

        director.update(3, 0, team, true);
        assertTrue(director.consumeJustCleared());
        assertEquals(2, director.upcomingKinder(), "en el respiro ya se juegan las del Kinder 2");
    }

    @Test
    @DisplayName("en la partida: completar una mision paga y exige estar en la sala")
    void sessionCompletesMissions() {
        GameSession session = new GameSession("mis", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD");
        session.start("SEGURIDAD");
        session.tick(System.currentTimeMillis(), 0.066);
        Player player = session.getOrCreatePlayer("SEGURIDAD");
        MissionView mission = session.missionsOf("SEGURIDAD").get(0);

        player.reportPosition(mission.floor(), mission.x() + 300, mission.y());
        assertEquals("too_far", session.attemptCompleteMission("SEGURIDAD", mission.missionId(),
                mission.x() + 300, mission.y()).reason());

        player.reportPosition(mission.floor(), mission.x(), mission.y());
        MissionResult result = session.attemptCompleteMission("SEGURIDAD", mission.missionId(), mission.x(), mission.y());
        assertTrue(result.success());
        assertEquals(mission.reward(), player.getGaravitos());
        assertEquals("unknown_mission", session.attemptCompleteMission("SEGURIDAD", mission.missionId(),
                mission.x(), mission.y()).reason());
        assertEquals(1, session.waveState().teamMissionsDone());
        assertEquals(MissionBoard.MISSIONS_PER_KINDER, session.waveState().teamMissionsRequired());
    }
}
