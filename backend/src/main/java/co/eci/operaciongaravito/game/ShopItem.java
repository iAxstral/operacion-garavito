package co.eci.operaciongaravito.game;

/**
 * Item disponible para comprar en un vendedor de stock ilimitado (vendedora
 * de la Cafeteria, maquina expendedora). A diferencia de {@link WorldItem}
 * (que vive en una posicion del mapa y se recoge caminando, recurso
 * compartido/limitado), un ShopItem no tiene posicion propia — el vendedor
 * la tiene — y en cambio tiene precio. {@code healAmount} es 0 para
 * WEAPON/AMMO (sin efecto de vida).
 */
public record ShopItem(String itemId, ItemType type, String itemName, int price, int healAmount) {
}
