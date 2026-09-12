package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Catalogo fijo de items recolectables del piso 1 (los 4 placeholder de
 * comida en la Cafeteria). Coordenadas en pixeles, deben coincidir con
 * frontend/src/game/itemCatalog.js — duplicado a proposito por ahora (ver
 * ARCHITECTURE.md, seccion "Vida e inventario").
 */
public final class WorldItemCatalog {

    private WorldItemCatalog() {
    }

    public static Map<String, WorldItem> defaultCatalog() {
        List<WorldItem> items = List.of(
                new WorldItem("cafeteria-food-1", ItemType.FOOD, "Sándwich", 1632, 1248),
                new WorldItem("cafeteria-food-2", ItemType.FOOD, "Fruta", 1888, 1248),
                new WorldItem("cafeteria-food-3", ItemType.FOOD, "Agua", 1632, 1440),
                new WorldItem("cafeteria-food-4", ItemType.FOOD, "Barra energética", 1888, 1440)
        );
        return new ConcurrentHashMap<>(items.stream().collect(Collectors.toMap(WorldItem::itemId, item -> item)));
    }
}
