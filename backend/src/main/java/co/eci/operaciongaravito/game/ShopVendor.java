package co.eci.operaciongaravito.game;

import java.util.List;

/**
 * Un vendedor de stock ilimitado en una posicion fija del mapa (vendedora
 * de la Cafeteria, maquina expendedora de armas). Posicion en pixeles,
 * debe coincidir con frontend/src/game/shopCatalog.js.
 */
public record ShopVendor(String vendorId, double x, double y, List<ShopItem> catalog) {

    public boolean sells(String itemId) {
        return catalog.stream().anyMatch(item -> item.itemId().equals(itemId));
    }
}
