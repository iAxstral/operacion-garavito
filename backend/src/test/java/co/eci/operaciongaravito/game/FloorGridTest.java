package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FloorGridTest {

    private final FloorGrid floor = FloorGrid.forFloor(1);

    @Test
    @DisplayName("el mapa tiene el tamaño que declara mapLayout.js")
    void dimensionsMatchTheFrontend() {
        assertTrue(floor.pixelWidth() == 40 * FloorGrid.TILE);
        assertTrue(floor.pixelHeight() == 30 * FloorGrid.TILE);
    }

    @Test
    @DisplayName("el spawn del jugador cae en piso caminable")
    void playerSpawnIsWalkable() {
        assertTrue(floor.isWalkable(608, 800));
    }

    @Test
    @DisplayName("todas las zonas de mision son alcanzables en su piso")
    void missionZonesAreWalkable() {
        MissionCatalog.ZONES.forEach(zone ->
                assertTrue(FloorGrid.forFloor(zone.floor()).isWalkable(zone.x(), zone.y()),
                        "la mision " + zone.missionId() + " quedo dentro de una pared"));
    }

    @Test
    @DisplayName("los vendedores son alcanzables")
    void vendorsAreWalkable() {
        ShopCatalog.VENDORS.forEach(vendor ->
                assertTrue(FloorGrid.forFloor(vendor.floor()).isWalkable(vendor.x(), vendor.y()),
                        "el vendedor " + vendor.vendorId() + " quedo dentro de una pared"));
    }

    @Test
    @DisplayName("todos los puntos de spawn de zombis son caminables y con holgura")
    void zombieSpawnsAreWalkable() {
        ZombieSpawnCatalog.POINTS.forEach(point ->
                assertTrue(floor.fits(point.x(), point.y(), 12),
                        "el spawn (" + point.x() + "," + point.y() + ") no tiene holgura"));
    }

    @Test
    @DisplayName("los items del mundo son alcanzables en su piso")
    void worldItemsAreWalkable() {
        WorldItemCatalog.defaultCatalog().values().forEach(item ->
                assertTrue(FloorGrid.forFloor(item.floor()).isWalkable(item.x(), item.y()),
                        "el item " + item.itemId() + " quedo dentro de una pared"));
    }

    @Test
    @DisplayName("cada piso tiene sus puertas y las misiones se reparten en los tres pisos")
    void floorsHaveDoorsAndMissions() {
        for (int floorNumber = 1; floorNumber <= FloorGrid.FLOOR_COUNT; floorNumber++) {
            final int current = floorNumber;
            assertTrue(FloorGrid.forFloor(current).doors().size() >= 4);
            assertTrue(MissionCatalog.ZONES.stream().anyMatch(zone -> zone.floor() == current),
                    "el piso " + current + " no tiene misiones");
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

        double playerX = 608;
        double playerY = 800;
        int[][] field = floor.distanceField(playerX, playerY);

        Zombie zombie = new Zombie("z1", 1, 736, 288, 2, 150);
        for (int i = 0; i < 900; i++) {
            zombie.step(floor, field, playerX, playerY, 0, 0, 0.066, 0);
        }

        double distance = Math.hypot(zombie.getX() - playerX, zombie.getY() - playerY);
        assertTrue(distance < 60, "el zombi quedo a " + Math.round(distance) + "px, no llego");
        assertTrue(floor.fits(zombie.getX(), zombie.getY(), 12), "termino dentro de una pared");
    }

    @Test
    @DisplayName("el campo de distancias marca inalcanzable lo que esta tapiado")
    void unreachableCellsAreMarked() {
        int[][] field = floor.distanceField(608, 800);

        assertTrue(field[0][0] == -1);
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
