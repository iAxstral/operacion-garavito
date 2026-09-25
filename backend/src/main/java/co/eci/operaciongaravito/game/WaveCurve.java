package co.eci.operaciongaravito.game;

import java.util.List;

/**
 * Los 5 Kinders de cada edificio. Una tabla y no una formula: son pocos, fijos y
 * hay que poder leerlos y ajustarlos de un vistazo.
 */
public final class WaveCurve {

    public static final int KINDER_COUNT = 5;

    /** Respiro entre un Kinder y el siguiente (y tras caer todo el equipo). */
    public static final long WAVE_REST_MS = 8_000;

    public static final int ZOMBIE_BASE_HEALTH = 2;
    public static final int ZOMBIE_TOUGH_HEALTH = 4;

    public static final double PLAYER_SPEED_PX_S = 160;

    /** Zombis vivos extra permitidos por cada jugador adicional en la sala. */
    public static final int EXTRA_ALIVE_PER_PLAYER = 3;

    private static final List<WaveBlueprint> KINDERS = List.of(
            new WaveBlueprint(1, 15, 8, 2, 1200, 0.0, 55, 75),
            new WaveBlueprint(2, 20, 10, 2, 1000, 0.0, 62, 85),
            new WaveBlueprint(3, 25, 12, 3, 900, 0.15, 70, 95),
            new WaveBlueprint(4, 30, 14, 3, 800, 0.3, 78, 110),
            new WaveBlueprint(5, 35, 16, 3, 700, 0.35, 85, 120)
    );

    private WaveCurve() {
    }

    /** @throws IllegalArgumentException si el Kinder no esta entre 1 y {@link #KINDER_COUNT} */
    public static WaveBlueprint blueprint(int kinder) {
        if (kinder < 1 || kinder > KINDER_COUNT) {
            throw new IllegalArgumentException("Kinder inexistente: " + kinder);
        }
        return KINDERS.get(kinder - 1);
    }

    public static int maxAlive(WaveBlueprint blueprint, int players) {
        return blueprint.maxAlive() + EXTRA_ALIVE_PER_PLAYER * Math.max(0, players - 1);
    }

    public static int rollHealth(WaveBlueprint blueprint, double roll) {
        return roll < blueprint.toughChance() ? ZOMBIE_TOUGH_HEALTH : ZOMBIE_BASE_HEALTH;
    }

    public static double rollSpeed(WaveBlueprint blueprint, double roll) {
        return blueprint.minSpeed() + roll * (blueprint.maxSpeed() - blueprint.minSpeed());
    }
}
