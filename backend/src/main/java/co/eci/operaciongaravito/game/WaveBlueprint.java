package co.eci.operaciongaravito.game;

/**
 * Como es un Kinder: cuantos zombis hay que matar para pasarlo, cuantos puede haber
 * vivos a la vez (con un jugador), cuantos aparecen por rafaga y cada cuanto.
 */
public record WaveBlueprint(
        int kinder,
        int killQuota,
        int maxAlive,
        int spawnBurst,
        long spawnIntervalMs,
        double toughChance,
        double minSpeed,
        double maxSpeed) {
}
