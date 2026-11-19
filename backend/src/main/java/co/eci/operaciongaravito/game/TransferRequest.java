package co.eci.operaciongaravito.game;

public record TransferRequest(String playerId, String targetId, int amount) {
}
