package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class FloorGridTest {

    private static final double PLAYER_SPAWN_X = 608;
    private static final double PLAYER_SPAWN_Y = 800;

    private final FloorGrid floor = FloorGrid.forFloor(Building.F, 1);

    @Test
    @DisplayName("el F tiene 3 pisos y el C 2; pedir un piso que no existe falla")
    void buildingsHaveTheirOwnFloorCount() {
        assertEquals(3, Building.F.floorCount());
        assertEquals(2, Building.C.floorCount());
        assertThrows(IllegalArgumentException.class, () -> FloorGrid.forFloor(Building.C, 3));
    }

    @Test
    @DisplayName("el piso 1 del F y el del C son mapas distintos")
    void buildingsDoNotShareTheFirstFloor() {
        FloorGrid c = FloorGrid.forFloor(Building.C, 1);
        // (288, 288): columna 4, fila 4 — pared en el F, Sala de Estudio en el C.
        assertFalse(floor.isWalkable(288, 288));
        assertTrue(c.isWalkable(288, 288));
    }

    @ParameterizedTest
    @EnumSource(Building.class)
    @DisplayName("el mapa tiene el tamaño que declara mapLayout.js")
    void dimensionsMatchTheFrontend(Building building) {
        for (int f = 1; f <= building.floorCount(); f++) {
            FloorGrid grid = FloorGrid.forFloor(building, f);
            assertEquals(40 * FloorGrid.TILE, grid.pixelWidth());
            assertEquals(30 * FloorGrid.TILE, grid.pixelHeight());
        }
    }

    @ParameterizedTest
    @EnumSource(Building.class)
    @DisplayName("el spawn del jugador cae en piso caminable en todos los pisos")
    void playerSpawnIsWalkable(Building building) {
        for (int f = 1; f <= building.floorCount(); f++) {
            assertTrue(FloorGrid.forFloor(building, f).isWalkable(PLAYER_SPAWN_X, PLAYER_SPAWN_Y),
                    building + " piso " + f);
        }
    }

    @ParameterizedTest
    @EnumSource(Building.class)
    @DisplayName("todas las zonas de mision son alcanzables en su piso")
    void missionZonesAreWalkable(Building building) {
        MissionCatalog.zonesFor(building).forEach(zone -> {
            assertTrue(building.hasFloor(zone.floor()), "mision en un piso que no existe: " + zone.missionId());
            assertTrue(FloorGrid.forFloor(building, zone.floor()).isWalkable(zone.x(), zone.y()),
                    building + ": la mision " + zone.missionId() + " quedo dentro de una pared");
        });
    }

    @ParameterizedTest
    @EnumSource(Building.class)
    @DisplayName("cada rol tiene al menos una mision en cada edificio")
    void everyRoleHasAMission(Building building) {
        for (Role role : Role.values()) {
            assertTrue(MissionCatalog.zonesFor(building).stream().anyMatch(z -> z.role().equals(role.name())),
                    building + " sin mision para " + role);
        }
    }

    @ParameterizedTest
    @EnumSource(Building.class)
    @DisplayName("los vendedores de los pisos del edificio son alcanzables")
    void vendorsAreWalkable(Building building) {
        ShopCatalog.VENDORS.stream().filter(vendor -> building.hasFloor(vendor.floor())).forEach(vendor ->
                assertTrue(FloorGrid.forFloor(building, vendor.floor()).isWalkable(vendor.x(), vendor.y()),
                        building + ": el vendedor " + vendor.vendorId() + " quedo dentro de una pared"));
    }

    @ParameterizedTest
    @EnumSource(Building.class)
    @DisplayName("los items del mundo de los pisos del edificio son alcanzables")
    void worldItemsAreWalkable(Building building) {
        WorldItemCatalog.defaultCatalog().values().stream().filter(item -> building.hasFloor(item.floor()))
                .forEach(item -> assertTrue(FloorGrid.forFloor(building, item.floor()).isWalkable(item.x(), item.y()),
                        building + ": el item " + item.itemId() + " quedo dentro de una pared"));
    }

    @ParameterizedTest
    @EnumSource(Building.class)
    @DisplayName("hay spawns de zombi por todo el piso, con holgura y conectados con el jugador")
    void zombieSpawnsCoverTheFloorAndReachThePlayer(Building building) {
        for (int f = 1; f <= building.floorCount(); f++) {
            FloorGrid grid = FloorGrid.forFloor(building, f);
            assertTrue(grid.spawnPoints().size() >= 40, building + " piso " + f + ": muy pocos spawns");
            int[][] field = grid.distanceField(PLAYER_SPAWN_X, PLAYER_SPAWN_Y);
            for (FloorGrid.SpawnPoint point : grid.spawnPoints()) {
                assertTrue(grid.fits(point.x(), point.y(), 12), "spawn sin holgura " + point);
                int col = (int) (point.x() / FloorGrid.TILE);
                int row = (int) (point.y() / FloorGrid.TILE);
                assertTrue(field[row][col] >= 0, building + " piso " + f + ": spawn aislado " + point);
            }
        }
    }

    @ParameterizedTest
    @EnumSource(Building.class)
    @DisplayName("cada piso tiene sus puertas")
    void floorsHaveDoors(Building building) {
        for (int f = 1; f <= building.floorCount(); f++) {
            assertTrue(FloorGrid.forFloor(building, f).doors().size() >= 4, building + " piso " + f);
        }
    }

    @Test
    @DisplayName("fuera del mapa no se puede caminar")
    void outsideTheMapIsSolid() {
        assertFalse(floor.isWalkable(-1, 100));
        assertFalse(floor.isWalkable(100, -1));
        assertFalse(floor.isWalkable(floor.pixelWidth() + 1, 100));
        assertFalse(floor.isWalkable(100, floor.pixelHeight() + 1));
    }

    @Test
    @DisplayName("las esquinas del mapa son pared")
    void bordersAreSolid() {
        assertFalse(floor.isWalkable(0, 0));
    }

    @Test
    @DisplayName("un zombi del aula encuentra el camino hasta el vestibulo")
    void zombiesNavigateBetweenRooms() {
        int[][] field = floor.distanceField(PLAYER_SPAWN_X, PLAYER_SPAWN_Y);

        Zombie zombie = new Zombie("z1", 1, 736, 288, 2, 150);
        for (int i = 0; i < 900; i++) {
            zombie.step(floor, field, PLAYER_SPAWN_X, PLAYER_SPAWN_Y, 0, 0, 0.066, 0);
        }

        double distance = Math.hypot(zombie.getX() - PLAYER_SPAWN_X, zombie.getY() - PLAYER_SPAWN_Y);
        assertTrue(distance < 60, "el zombi quedo a " + Math.round(distance) + "px, no llego");
        assertTrue(floor.fits(zombie.getX(), zombie.getY(), 12), "termino dentro de una pared");
    }

    @Test
    @DisplayName("el campo de distancias marca inalcanzable lo que esta tapiado")
    void unreachableCellsAreMarked() {
        int[][] field = floor.distanceField(PLAYER_SPAWN_X, PLAYER_SPAWN_Y);

        assertEquals(-1, field[0][0]);
    }

    @Test
    @DisplayName("un zombi no atraviesa una pared persiguiendo al jugador")
    void zombiesDoNotWalkThroughWalls() {
        Zombie zombie = new Zombie("z1", 1, 800, 736, 2, 150);
        double startY = zombie.getY();

        for (int i = 0; i < 120; i++) {
            zombie.step(floor, floor.distanceField(800, 0), 800, 0, 0, 0, 0.066, 0);
        }

        assertTrue(floor.fits(zombie.getX(), zombie.getY(), 12),
                "el zombi termino dentro de una pared");
        assertTrue(zombie.getY() <= startY, "deberia haber avanzado hacia arriba o quedarse");
    }
}
