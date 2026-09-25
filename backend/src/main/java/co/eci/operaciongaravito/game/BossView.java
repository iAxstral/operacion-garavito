package co.eci.operaciongaravito.game;

/**
 * Vista publica del jefe, tal como viaja en el broadcast. La direccion hacia donde mira
 * la deduce el cliente del movimiento entre ticks.
 */
public record BossView(String id, String name, int floor, long x, long y, int health, int maxHealth,
                       BossState state) {
}
