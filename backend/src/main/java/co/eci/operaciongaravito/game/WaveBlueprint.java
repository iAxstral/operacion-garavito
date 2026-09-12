package co.eci.operaciongaravito.game;

/** Como es una oleada concreta. Lo produce {@link WaveCurve#blueprint(int)}. */
public record WaveBlueprint(
        int wave,
        int total,
        long spawnIntervalMs,
        double toughChance,
        double minSpeed,
        double maxSpeed) {
}
