package co.eci.operaciongaravito.game;

public final class WaveCurve {

    public static final long WAVE_REST_MS = 6_000;

    public static final int ZOMBIE_BASE_HEALTH = 2;
    public static final int ZOMBIE_TOUGH_HEALTH = 4;

    private static final int FIRST_TOUGH_WAVE = 4;

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

    public static int rollHealth(WaveBlueprint blueprint, double roll) {
        return roll < blueprint.toughChance() ? ZOMBIE_TOUGH_HEALTH : ZOMBIE_BASE_HEALTH;
    }

    public static double rollSpeed(WaveBlueprint blueprint, double roll) {
        return blueprint.minSpeed() + roll * (blueprint.maxSpeed() - blueprint.minSpeed());
    }
}
