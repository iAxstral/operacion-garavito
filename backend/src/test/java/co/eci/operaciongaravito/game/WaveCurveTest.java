package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WaveCurveTest {

    @Test
    @DisplayName("hay exactamente 5 Kinders")
    void thereAreFiveKinders() {
        assertEquals(5, WaveCurve.KINDER_COUNT);
        for (int k = 1; k <= 5; k++) {
            assertEquals(k, WaveCurve.blueprint(k).kinder());
        }
        assertThrows(IllegalArgumentException.class, () -> WaveCurve.blueprint(0));
        assertThrows(IllegalArgumentException.class, () -> WaveCurve.blueprint(6));
    }

    @Test
    @DisplayName("solo el ultimo Kinder es el del jefe")
    void onlyTheLastKinderHasTheBoss() {
        for (int k = 1; k < WaveCurve.KINDER_COUNT; k++) {
            assertTrue(!WaveCurve.blueprint(k).boss(), "Kinder " + k);
        }
        assertTrue(WaveCurve.blueprint(WaveCurve.KINDER_COUNT).boss());
    }

    @Test
    @DisplayName("cada Kinder pide mas kills, admite mas zombis vivos y spawnea mas seguido")
    void difficultyGrows() {
        for (int k = 1; k < WaveCurve.KINDER_COUNT - 1; k++) {
            WaveBlueprint current = WaveCurve.blueprint(k);
            WaveBlueprint next = WaveCurve.blueprint(k + 1);
            assertTrue(next.killQuota() > current.killQuota(), "cuota del Kinder " + (k + 1));
            assertTrue(next.maxAlive() >= current.maxAlive(), "vivos del Kinder " + (k + 1));
            assertTrue(next.spawnIntervalMs() < current.spawnIntervalMs(), "cadencia del Kinder " + (k + 1));
        }
    }

    @Test
    @DisplayName("siempre aparecen varios zombis a la vez: la cuota es mas alta que el tope de vivos")
    void manyZombiesAtOnce() {
        for (int k = 1; k <= WaveCurve.KINDER_COUNT; k++) {
            WaveBlueprint blueprint = WaveCurve.blueprint(k);
            assertTrue(blueprint.spawnBurst() >= 1, "rafaga del Kinder " + k);
            assertTrue(blueprint.maxAlive() >= 2, "vivos del Kinder " + k);
            if (!blueprint.boss()) {
                assertTrue(blueprint.killQuota() > blueprint.maxAlive(), "cuota del Kinder " + k);
            }
        }
    }

    @Test
    @DisplayName("el Kinder 1 da margen de reaccion: como mucho 2 zombis muerden a la vez")
    void kinderOneStaysGentle() {
        assertTrue(WaveCurve.blueprint(1).maxAlive() <= 2, "el Kinder 1 no deberia rodear al jugador con mas de 2 zombis");
    }

    @Test
    @DisplayName("del Kinder 3 en adelante el tope de vivos ya exige pelear en grupo")
    void laterKindersStaySwarmy() {
        for (int k = 3; k <= WaveCurve.KINDER_COUNT; k++) {
            assertTrue(WaveCurve.blueprint(k).maxAlive() >= 8, "vivos del Kinder " + k);
        }
    }

    @Test
    @DisplayName("el tope de vivos escala con los jugadores de la sala")
    void maxAliveScalesWithPlayers() {
        WaveBlueprint first = WaveCurve.blueprint(1);
        assertEquals(first.maxAlive(), WaveCurve.maxAlive(first, 1));
        assertEquals(first.maxAlive() + 3 * WaveCurve.EXTRA_ALIVE_PER_PLAYER, WaveCurve.maxAlive(first, 4));
    }

    @Test
    @DisplayName("los zombis nunca son mas rapidos que el jugador")
    void zombiesNeverOutrunThePlayer() {
        for (int k = 1; k <= WaveCurve.KINDER_COUNT; k++) {
            WaveBlueprint blueprint = WaveCurve.blueprint(k);
            assertTrue(blueprint.maxSpeed() < WaveCurve.PLAYER_SPEED_PX_S, "Kinder " + k);
            assertTrue(blueprint.minSpeed() <= blueprint.maxSpeed());
        }
    }

    @Test
    @DisplayName("los primeros Kinders no traen zombis tesos")
    void noToughZombiesEarly() {
        for (int k = 1; k <= 2; k++) {
            WaveBlueprint blueprint = WaveCurve.blueprint(k);
            assertEquals(WaveCurve.ZOMBIE_BASE_HEALTH, WaveCurve.rollHealth(blueprint, 0.0));
        }
        assertEquals(WaveCurve.ZOMBIE_TOUGH_HEALTH, WaveCurve.rollHealth(WaveCurve.blueprint(4), 0.0));
    }

    @Test
    @DisplayName("la velocidad sorteada queda dentro del rango del Kinder")
    void rolledSpeedStaysInRange() {
        WaveBlueprint blueprint = WaveCurve.blueprint(3);
        assertEquals(blueprint.minSpeed(), WaveCurve.rollSpeed(blueprint, 0.0));
        assertTrue(WaveCurve.rollSpeed(blueprint, 0.999) < blueprint.maxSpeed());
    }
}
