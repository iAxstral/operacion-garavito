package co.eci.operaciongaravito.game;

/** Una bola de acido tal como viaja al cliente. */
public record ProjectileState(String id, int floor, long x, long y, double angle) {
}
