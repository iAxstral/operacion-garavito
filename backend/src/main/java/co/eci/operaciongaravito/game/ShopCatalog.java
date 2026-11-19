package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public final class ShopCatalog {

    public static final List<ShopItem> CAFETERIA_MENU = List.of(
            new ShopItem("shop-empanada", ItemType.FOOD, "Empanada", 10, 20),
            new ShopItem("shop-arepa", ItemType.FOOD, "Arepa", 8, 15),
            new ShopItem("shop-energizante", ItemType.FOOD, "Energizante", 12, 10),
            new ShopItem("shop-gaseosa", ItemType.FOOD, "Gaseosa", 6, 5)
    );

    public static final List<ShopItem> WEAPON_MACHINE_MENU = List.of(

            new ShopItem("shop-hacha", ItemType.WEAPON, "Hacha", 20, 0),
            new ShopItem("shop-pistola", ItemType.WEAPON, "Pistola", 35, 0),
            new ShopItem("shop-rifle", ItemType.WEAPON, "Rifle", 80, 0),
            // Paquete de Player.AMMO_PER_PACK balas: no ocupa espacio en el inventario.
            new ShopItem("shop-municion", ItemType.AMMO, "Munición", 8, 0)
    );

    public static final ShopVendor CAFETERIA_VENDOR = new ShopVendor("cafeteria", 1, 1696, 1440, CAFETERIA_MENU);
    public static final ShopVendor WEAPON_MACHINE = new ShopVendor("weapon-machine", 2, 1888, 1120, WEAPON_MACHINE_MENU);

    public static final List<ShopVendor> VENDORS = List.of(CAFETERIA_VENDOR, WEAPON_MACHINE);

    private static final Map<String, ShopItem> ITEMS_BY_ID = Stream.concat(CAFETERIA_MENU.stream(), WEAPON_MACHINE_MENU.stream())
            .collect(Collectors.toMap(ShopItem::itemId, item -> item));

    private ShopCatalog() {
    }

    public static ShopItem itemById(String itemId) {
        return ITEMS_BY_ID.get(itemId);
    }

    public static ShopVendor vendorSelling(String itemId) {
        return VENDORS.stream().filter(vendor -> vendor.sells(itemId)).findFirst().orElse(null);
    }
}
