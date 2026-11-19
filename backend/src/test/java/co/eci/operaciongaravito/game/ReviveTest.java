package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ReviveTest {

    private GameSession session;
    private Player medic;
    private Player guard;
    private Player economist;

    @BeforeEach
    void setUp() {
        session = new GameSession("revivir", Building.F, BossConfig.defaults());
        session.joinPlayer("SALUD");
        session.joinPlayer("SEGURIDAD");
        session.joinPlayer("ECONOMIA");
        session.start("SALUD");
        medic = session.getOrCreatePlayer("SALUD");
        guard = session.getOrCreatePlayer("SEGURIDAD");
        economist = session.getOrCreatePlayer("ECONOMIA");
        medic.reportPosition(1, 600, 800);
        guard.reportPosition(1, 640, 800);
        economist.reportPosition(1, 620, 820);
        knockDown(guard);
    }

    private static void knockDown(Player player) {
        while (player.isAlive()) {
            player.takeDamage(25);
        }
    }

    @Test
    @DisplayName("Biomedica revive a un compañero caido manteniendo 3 segundos")
    void theMedicRevives() {
        long start = System.currentTimeMillis();
        assertTrue(session.attemptReviveStart("SALUD", "SEGURIDAD").success());

        // Antes de tiempo sigue caido.
        assertFalse(guard.isAlive());
        assertTrue(medic.reviveProgress(start + GameSession.REVIVE_MS / 2) > 0.3);

        forceRestOver();
        session.tick(medic.getReviveUntil(), 0.066);

        assertTrue(guard.isAlive());
        assertEquals(GameSession.FIELD_REVIVE_HEALTH, guard.getHealth());
        assertNull(medic.getReviveTargetId());
        LastEvent event = session.pollEvent();
        assertEquals("REVIVED", event.type());
        assertEquals("SEGURIDAD", event.playerId());
    }

    @Test
    @DisplayName("solo Biomedica puede revivir")
    void onlyTheMedicCanRevive() {
        assertEquals("wrong_role", session.attemptReviveStart("ECONOMIA", "SEGURIDAD").reason());
    }

    @Test
    @DisplayName("hay que estar al lado del caido")
    void reviveNeedsToBeClose() {
        medic.reportPosition(1, 900, 800);
        assertEquals("too_far", session.attemptReviveStart("SALUD", "SEGURIDAD").reason());
    }

    @Test
    @DisplayName("alejarse corta la reanimacion")
    void walkingAwayCancels() {
        assertTrue(session.attemptReviveStart("SALUD", "SEGURIDAD").success());
        medic.reportPosition(1, 600 + GameSession.REVIVE_BREAK_PX + 60, 800);
        forceRestOver();
        session.tick(medic.getReviveUntil(), 0.066);

        assertFalse(guard.isAlive());
        assertNull(medic.getReviveTargetId());
    }

    @Test
    @DisplayName("recibir dano corta la reanimacion")
    void takingDamageCancels() throws InterruptedException {
        assertTrue(session.attemptReviveStart("SALUD", "SEGURIDAD").success());
        Thread.sleep(5);
        medic.takeDamage(5);
        forceRestOver();
        session.tick(medic.getReviveUntil(), 0.066);

        assertFalse(guard.isAlive());
    }

    @Test
    @DisplayName("un caido no puede moverse")
    void downedPlayersStayPut() {
        session.reportPosition("SEGURIDAD", 2, 100, 100);
        assertEquals(1, guard.getFloor());
        assertEquals(640, guard.getX());
    }

    @Test
    @DisplayName("no se revive a quien ya esta de pie")
    void cannotReviveTheLiving() {
        assertEquals("not_downed", session.attemptReviveStart("SALUD", "ECONOMIA").reason());
    }

    /**
     * Durante el respiro todos los caidos se levantan solos; para probar la reanimacion
     * manual se pasa el director a un Kinder activo.
     */
    private void forceRestOver() {
        try {
            java.lang.reflect.Field field = GameSession.class.getDeclaredField("waveDirector");
            field.setAccessible(true);
            WaveDirector director = (WaveDirector) field.get(session);
            director.resetRun(0, 0);
            director.update(1, 0, java.util.List.of());
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
    }
}
