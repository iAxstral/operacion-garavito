package co.eci.operaciongaravito.game;

/** Vista publica de un Zombie, tal como viaja en el broadcast del tick. */
public record ZombieState(String id, long x, long y, int health, boolean tough) {
}
