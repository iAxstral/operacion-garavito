package co.eci.operaciongaravito.game;

/** Payload de POST /app/game/{gameId}/mission/complete. x/y = posicion actual del jugador (px). */
public record MissionCompleteRequest(String playerId, String missionId, double x, double y) {
}
