package co.eci.operaciongaravito.game;

/** Una barricada tal como viaja al cliente. */
public record BarricadeState(String id, String ownerId, int floor, int col, int row, int health, int maxHealth) {
}
