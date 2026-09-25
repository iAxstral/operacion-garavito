package co.eci.operaciongaravito.game;

/**
 * Como es un Kinder: cuantos zombis hay que matar para pasarlo, cuantos puede haber
 * vivos a la vez (con un jugador), cuantos aparecen por rafaga y cada cuanto. En el
 * Kinder del jefe ({@code boss}) la cuota no aplica: se pasa matando al jefe.
 */
public record WaveBlueprint(
        int kinder,
        int killQuota,
        int maxAlive,
        int spawnBurst,
        long spawnIntervalMs,
        double toughChance,
        double minSpeed,
        double maxSpeed,
        boolean boss) {
}
