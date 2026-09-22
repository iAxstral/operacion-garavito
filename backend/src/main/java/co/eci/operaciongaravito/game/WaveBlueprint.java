package co.eci.operaciongaravito.game;

public record WaveBlueprint(
        int wave,
        int total,
        long spawnIntervalMs,
        double toughChance,
        double minSpeed,
        double maxSpeed) {
}
