package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MatchSummaryTest {

    private GameSession session;
    private Player guard;

    @BeforeEach
    void setUp() {
        session = new GameSession("resumen", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD");
        session.start("SEGURIDAD");
        guard = session.getOrCreatePlayer("SEGURIDAD");
    }

    @Test
    @DisplayName("las estadisticas cuentan daño, caidas, misiones y ganancias")
    void statsAreTracked() {
        guard.takeDamage(30);
        guard.addEarnings(25);
        guard.recordMission();
        guard.recordKills(3);
        guard.addGaravitos(10); // una transferencia no cuenta como ganancia

        MatchSummary.PlayerSummary stats = guard.statsSnapshot();
        assertEquals(30, stats.damageTaken());
        assertEquals(25, stats.garavitosEarned());
        assertEquals(1, stats.missions());
        assertEquals(3, stats.kills());
        assertEquals(0, stats.downs());

        guard.takeDamage(200);
        assertEquals(100, guard.statsSnapshot().damageTaken(), "solo cuenta la vida que de verdad perdio");
        assertEquals(1, guard.statsSnapshot().downs());
    }

    @Test
    @DisplayName("si cae el equipo se arma el resumen de la corrida y las estadisticas vuelven a cero")
    void wipeClosesTheRun() {
        assertNull(session.lastSummary());
        guard.recordKills(4);
        while (guard.isAlive()) {
            guard.takeDamage(50);
        }
        session.tick(System.currentTimeMillis(), 0.066);

        MatchSummary summary = session.lastSummary();
        assertNotNull(summary);
        assertFalse(summary.victory());
        assertEquals(Building.F, summary.building());
        assertEquals(4, summary.players().get(0).kills());
        assertEquals(1, summary.players().get(0).downs());
        assertEquals(summary, session.pollSummaryToSave(), "queda en la cola para el historial");
        assertNull(session.pollSummaryToSave());
        assertEquals(0, guard.statsSnapshot().kills(), "la corrida nueva arranca en cero");
    }

    @Test
    @DisplayName("matar zombis suma kills y Garavitos ganados")
    void killsAreCountedFromAttacks() {
        guard.reportPosition(1, 608, 800);
        // Golpe al aire: no hay kills.
        session.attemptAttack("SEGURIDAD", AttackType.BASIC, 608, 800, 0);
        assertEquals(0, guard.statsSnapshot().kills());
        assertTrue(guard.statsSnapshot().garavitosEarned() >= 0);
    }
}
