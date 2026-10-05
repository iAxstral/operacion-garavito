package co.eci.operaciongaravito.game;

import java.util.List;

public record ShopVendor(String vendorId, int floor, double x, double y, List<ShopItem> catalog) {

    public boolean sells(String itemId) {
        return catalog.stream().anyMatch(item -> item.itemId().equals(itemId));
    }
}
