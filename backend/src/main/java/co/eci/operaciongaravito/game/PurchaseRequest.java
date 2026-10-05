package co.eci.operaciongaravito.game;

public record PurchaseRequest(String playerId, String itemId, double x, double y) {
}
