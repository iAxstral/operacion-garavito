package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public final class WorldItemCatalog {

    private WorldItemCatalog() {
    }

    public static Map<String, WorldItem> defaultCatalog() {
        List<WorldItem> items = List.of(
                new WorldItem("cafeteria-food-1", ItemType.FOOD, "Sándwich", 1, 1632, 1248),
                new WorldItem("cafeteria-food-2", ItemType.FOOD, "Fruta", 1, 1888, 1248),
                new WorldItem("cafeteria-food-3", ItemType.FOOD, "Agua", 1, 1632, 1440),
                new WorldItem("cafeteria-food-4", ItemType.FOOD, "Barra energética", 1, 1888, 1440),
                new WorldItem("estudio-food-1", ItemType.FOOD, "Café", 2, 640, 1344),
                new WorldItem("biblioteca-food-1", ItemType.FOOD, "Galletas", 2, 640, 288),
                new WorldItem("auditorio-food-1", ItemType.FOOD, "Jugo", 3, 640, 1216),
                new WorldItem("servidores-food-1", ItemType.FOOD, "Barra energética", 3, 1536, 416)
        );
        return new ConcurrentHashMap<>(items.stream().collect(Collectors.toMap(WorldItem::itemId, item -> item)));
    }
}
