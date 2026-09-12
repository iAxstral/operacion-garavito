package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Catalogos + posicion de los dos vendedores de stock ilimitado del piso 1.
 * Precios y valores de vida son placeholder — ver ARCHITECTURE.md para el
 * razonamiento. Debe coincidir exactamente con
 * frontend/src/game/shopCatalog.js (itemId, precio, healAmount, posicion
 * de cada vendedor — duplicado a proposito, mismo patron que
 * WorldItemCatalog/itemCatalog.js).
 */
public final class ShopCatalog {

    public static final List<ShopItem> CAFETERIA_MENU = List.of(
            new ShopItem("shop-empanada", ItemType.FOOD, "Empanada", 10, 20),
            new ShopItem("shop-arepa", ItemType.FOOD, "Arepa", 8, 15),
            new ShopItem("shop-energizante", ItemType.FOOD, "Energizante", 12, 10),
            new ShopItem("shop-gaseosa", ItemType.FOOD, "Gaseosa", 6, 5)
    );

    public static final List<ShopItem> WEAPON_MACHINE_MENU = List.of(
            // Arma inicial: cuesta exactamente lo que paga una mision de rol
            // (MissionCatalog.REWARD_GARAVITOS), asi la primera mision que
            // complete un jugador le alcanza justo para armarse.
            new ShopItem("shop-hacha", ItemType.WEAPON, "Hacha", MissionCatalog.REWARD_GARAVITOS, 0),
            new ShopItem("shop-pistola", ItemType.WEAPON, "Pistola", 50, 0),
            new ShopItem("shop-rifle", ItemType.WEAPON, "Rifle", 90, 0),
            new ShopItem("shop-municion", ItemType.AMMO, "Munición", 15, 0)
    );

    // Posiciones dentro de la Cafeteria (mapLayout.js), lejos de las mesas
    // placeholder y del carril de la puerta.
    public static final ShopVendor CAFETERIA_VENDOR = new ShopVendor("cafeteria", 1696, 1440, CAFETERIA_MENU);
    public static final ShopVendor WEAPON_MACHINE = new ShopVendor("weapon-machine", 1888, 1120, WEAPON_MACHINE_MENU);

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
