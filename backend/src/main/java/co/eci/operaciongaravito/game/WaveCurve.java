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

    // Kinder 1-2: rebajados tras medir con evidencia real (log de vida cada 1s con
    // un jugador quieto). Primer intento: bajar maxAlive de 8 a 3 no alcanzo — una
    // vez que los 3 convergen y sincronizan la mordida (2 de dano cada 600ms POR
    // zombi, independiente entre ellos) el techo de dano siguio siendo ~10/s, igual
    // que con 8 (la mordida solo depende de cuantos entran en CONTACT_RANGE_PX a la
    // vez, no del total vivo). Bajar a 2 vivos si baja el techo real a ~6.7/s. Kinder
    // 3-5 quedan igual: la escalada de dificultad sigue ahi.
    private static final List<WaveBlueprint> KINDERS = List.of(
            new WaveBlueprint(1, 8, 2, 2, 1200, 0.0, 55, 75, false),
            new WaveBlueprint(2, 14, 4, 2, 1000, 0.0, 62, 85, false),
            new WaveBlueprint(3, 25, 12, 3, 900, 0.15, 70, 95, false),
            new WaveBlueprint(4, 30, 14, 3, 800, 0.3, 78, 110, false),
            // Kinder 5: el Ingeniero de Sistemas con su escolta. Se pasa matando al jefe.
            new WaveBlueprint(5, 0, 8, 2, 1500, 0.35, 85, 120, true)
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
