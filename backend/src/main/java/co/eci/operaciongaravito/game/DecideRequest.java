package co.eci.operaciongaravito.game;

/** Payload de POST /app/game/{gameId}/decide. playerId == rol (ver Player). */
public record DecideRequest(String playerId, String action) {
}
