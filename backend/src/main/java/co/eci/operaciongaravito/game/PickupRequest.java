package co.eci.operaciongaravito.game;

public record PickupRequest(String playerId, String itemId, double x, double y) {
}
