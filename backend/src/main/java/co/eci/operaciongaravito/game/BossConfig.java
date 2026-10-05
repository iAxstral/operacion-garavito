package co.eci.operaciongaravito.game;

/**
 * Parametros de la IA del jefe. Salen de application.properties ({@code game.boss.*},
 * ver {@link GameSessionService}); {@link #defaults()} son los mismos valores.
 *
 * @param detectionRadiusTiles distancia (en tiles) a la que ve a un jugador con linea de vision
 * @param attackRadiusTiles    distancia (en tiles) a la que muerde
 * @param repathMs             cada cuanto recalcula el camino A* mientras persigue
 * @param alertMs              cuanto dura el aviso antes de lanzarse a perseguir
 * @param stunMs               cuanto queda aturdido tras un golpe cargado
 * @param loseTargetMs         sin ver a nadie por este tiempo, vuelve a patrullar
 * @param speedPxPerSecond     velocidad (por debajo de la del jugador)
 * @param maxHealth            vida
 * @param biteDamage           daño de cada mordida
 * @param attackCooldownMs     tiempo entre mordidas
 */
public record BossConfig(
        double detectionRadiusTiles,
        double attackRadiusTiles,
        long repathMs,
        long alertMs,
        long stunMs,
        long loseTargetMs,
        double speedPxPerSecond,
        int maxHealth,
        int biteDamage,
        long attackCooldownMs) {

    public static BossConfig defaults() {
        return new BossConfig(8, 1, 500, 600, 1500, 3000, 115, 24, 12, 900);
    }

    public double detectionRadiusPx() {
        return detectionRadiusTiles * FloorGrid.TILE;
    }

    public double attackRadiusPx() {
        return attackRadiusTiles * FloorGrid.TILE;
    }
}
