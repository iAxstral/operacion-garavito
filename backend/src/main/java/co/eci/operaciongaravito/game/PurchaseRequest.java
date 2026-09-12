package co.eci.operaciongaravito.game;

/** Payload de POST /app/game/{gameId}/purchase. x/y = posicion actual del jugador (px). */
public record PurchaseRequest(String playerId, String itemId, double x, double y) {
}
