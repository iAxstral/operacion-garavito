package co.eci.operaciongaravito.game;

/** Payload de POST /app/game/{gameId}/join. */
public record JoinRequest(String role) {
}
