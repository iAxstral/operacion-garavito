package co.eci.operaciongaravito.game;

public record MissionCompleteRequest(String playerId, String missionId, double x, double y) {
}
