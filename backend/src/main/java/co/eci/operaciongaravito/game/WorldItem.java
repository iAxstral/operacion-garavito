package co.eci.operaciongaravito.game;

public record WorldItem(String itemId, ItemType type, String itemName, int floor, double x, double y) {
}
