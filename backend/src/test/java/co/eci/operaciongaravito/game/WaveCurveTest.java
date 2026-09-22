package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WaveCurveTest {

    @Test
    @DisplayName("cada oleada trae mas zombis y los spawnea mas rapido")
    void difficultyIsMonotonic() {
        for (int wave = 1; wave < 30; wave++) {
            WaveBlueprint current = WaveCurve.blueprint(wave);
            WaveBlueprint next = WaveCurve.blueprint(wave + 1);

            assertTrue(next.total() > current.total(),
                    "la oleada " + (wave + 1) + " no trae mas zombis");
            assertTrue(next.spawnIntervalMs() <= current.spawnIntervalMs(),
                    "la oleada " + (wave + 1) + " spawnea mas lento");
        }
    }

    @Test
    @DisplayName("los zombis nunca corren mas que el jugador")
    void zombiesNeverOutrunThePlayer() {
        for (int wave = 1; wave < 200; wave++) {
            WaveBlueprint blueprint = WaveCurve.blueprint(wave);
            assertTrue(blueprint.maxSpeed() < WaveCurve.PLAYER_SPEED_PX_S,
                    "la oleada " + wave + " deja al zombi mas rapido que el jugador");
            assertTrue(blueprint.minSpeed() <= blueprint.maxSpeed());
        }
    }

    @Test
    @DisplayName("la cadencia de spawn tiene piso")
    void spawnIntervalHasFloor() {
        assertTrue(WaveCurve.blueprint(500).spawnIntervalMs() >= 350);
    }

    @Test
    @DisplayName("no hay zombis tesos en las primeras tres oleadas")
    void noToughZombiesEarly() {
        for (int wave = 1; wave <= 3; wave++) {
            WaveBlueprint blueprint = WaveCurve.blueprint(wave);
            assertEquals(0, blueprint.toughChance());
            assertEquals(WaveCurve.ZOMBIE_BASE_HEALTH, WaveCurve.rollHealth(blueprint, 0.0));
            assertEquals(WaveCurve.ZOMBIE_BASE_HEALTH, WaveCurve.rollHealth(blueprint, 0.99));
        }
        assertEquals(WaveCurve.ZOMBIE_TOUGH_HEALTH, WaveCurve.rollHealth(WaveCurve.blueprint(4), 0.0));
    }

    @Test
    @DisplayName("la proporcion de tesos crece pero se topa en la mitad")
    void toughChanceIsCapped() {
        for (int wave = 4; wave < 200; wave++) {
            double chance = WaveCurve.blueprint(wave).toughChance();
            assertTrue(chance <= 0.5, "la oleada " + wave + " pasa de 50% de tesos");
        }
        assertTrue(WaveCurve.blueprint(10).toughChance() > WaveCurve.blueprint(4).toughChance());
    }

    @Test
    @DisplayName("la velocidad sorteada se queda dentro del rango de la oleada")
    void rolledSpeedStaysInRange() {
        WaveBlueprint blueprint = WaveCurve.blueprint(3);
        assertEquals(blueprint.minSpeed(), WaveCurve.rollSpeed(blueprint, 0.0));
        assertTrue(WaveCurve.rollSpeed(blueprint, 0.999) < blueprint.maxSpeed());
    }

    @Test
    @DisplayName("la primera oleada es la que la spec promete")
    void firstWaveMatchesTheSpec() {
        WaveBlueprint first = WaveCurve.blueprint(1);
        assertEquals(5, first.total());
        assertEquals(1250, first.spawnIntervalMs());
    }
}
