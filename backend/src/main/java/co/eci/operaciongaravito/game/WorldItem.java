package co.eci.operaciongaravito.game;

/**
 * Item tal como vive en el mapa, antes de ser recogido. {@code x}/{@code y}
 * son la posicion en pixeles del mundo del piso 1 — deben coincidir con las
 * mismas coordenadas usadas en frontend/src/game/itemCatalog.js (duplicado
 * a proposito por ahora; ver ARCHITECTURE.md).
 */
public record WorldItem(String itemId, ItemType type, String itemName, double x, double y) {
}
