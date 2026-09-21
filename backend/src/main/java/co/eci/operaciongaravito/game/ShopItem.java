package co.eci.operaciongaravito.game;

public record ShopItem(String itemId, ItemType type, String itemName, int price, int healAmount) {
}
