package co.eci.operaciongaravito.game;

/** Payload de POST /app/game/{gameId}/pickup. x/y = posicion actual del jugador (px). */
public record PickupRequest(String playerId, String itemId, double x, double y) {
}
