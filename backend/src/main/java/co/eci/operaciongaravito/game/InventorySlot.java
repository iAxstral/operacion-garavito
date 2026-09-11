package co.eci.operaciongaravito.game;

/** Item tal como vive en el inventario de un jugador (sin posicion en el mapa). */
public record InventorySlot(ItemType type, String itemId, String itemName) {
}
