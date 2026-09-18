package co.eci.operaciongaravito.game;

import java.util.List;

/**
 * Catalogo fijo de las puertas del piso 1, en coordenadas de GRILLA (no
 * pixeles) para poder marcarlas como bloqueadas en {@link FloorGrid}. Debe
 * coincidir con las posiciones de DOOR_COL_AULA/DOOR_COL_CAFETERIA y las
 * filas calculadas en frontend/src/game/mapLayout.js — mismo acuerdo manual
 * que MissionCatalog/ShopCatalog con sus contrapartes del frontend.
 */
public final class DoorCatalog {

    public record DoorSpec(String doorId, int col, int row) {
        public double centerX() {
            return col * FloorGrid.TILE + FloorGrid.TILE / 2.0;
        }

        public double centerY() {
            return row * FloorGrid.TILE + FloorGrid.TILE / 2.0;
        }
    }

    public static final List<DoorSpec> DOORS = List.of(
            new DoorSpec("door-aula", 9, 7),
            new DoorSpec("door-terraza", 9, 16),
            new DoorSpec("door-cafeteria", 27, 16));

    public static DoorSpec byId(String doorId) {
        return DOORS.stream().filter(d -> d.doorId().equals(doorId)).findFirst().orElse(null);
    }

    private DoorCatalog() {
    }
}
