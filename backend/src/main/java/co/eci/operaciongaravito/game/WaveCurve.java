package co.eci.operaciongaravito.game;

/**
 * Curva de dificultad de las oleadas: cuantos zombis, cada cuanto aparecen,
 * cuanta vida y cuanta velocidad traen.
 *
 * Es una sola formula y no una tabla a proposito — asi la dificultad se puede
 * leer y ajustar de un vistazo, sin recorrer casos especiales, y sigue
 * definida para cualquier numero de oleada. Funciones puras, sin estado: lo
 * que decide *cuando* aplicarlas es {@link WaveDirector}.
 */
public final class WaveCurve {

    /** Respiro entre que se limpia una oleada y arranca la siguiente. */
    public static final long WAVE_REST_MS = 6_000;

    public static final int ZOMBIE_BASE_HEALTH = 2;
    public static final int ZOMBIE_TOUGH_HEALTH = 4;

    /** Los zombis tesos recien aparecen cuando el jugador ya pudo armarse. */
    private static final int FIRST_TOUGH_WAVE = 4;

    /**
     * Velocidad del jugador (PLAYER_SPEED en MainScene.js). La velocidad de
     * los zombis se topa por debajo de este valor: quedar acorralado tiene que
     * ser un error de posicionamiento, no algo inevitable.
     */
    public static final double PLAYER_SPEED_PX_S = 160;

    private static final double MAX_ZOMBIE_MIN_SPEED = 120;
    private static final double MAX_ZOMBIE_MAX_SPEED = 150;

    private WaveCurve() {
    }

    public static WaveBlueprint blueprint(int wave) {
        return new WaveBlueprint(
                wave,
                5 + 3 * (wave - 1),
                Math.max(350, 1250 - 150L * (wave - 1)),
                wave < FIRST_TOUGH_WAVE ? 0 : Math.min(0.5, 0.25 + 0.05 * (wave - FIRST_TOUGH_WAVE)),
                Math.min(MAX_ZOMBIE_MIN_SPEED, 55 + 4.0 * (wave - 1)),
                Math.min(MAX_ZOMBIE_MAX_SPEED, 75 + 4.0 * (wave - 1))
        );
    }

    /** Vida del proximo zombi, dado un sorteo en [0,1). */
    public static int rollHealth(WaveBlueprint blueprint, double roll) {
        return roll < blueprint.toughChance() ? ZOMBIE_TOUGH_HEALTH : ZOMBIE_BASE_HEALTH;
    }

    /** Velocidad del proximo zombi, dado un sorteo en [0,1). */
    public static double rollSpeed(WaveBlueprint blueprint, double roll) {
        return blueprint.minSpeed() + roll * (blueprint.maxSpeed() - blueprint.minSpeed());
    }
}
