package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * La grilla se genera desde mapLayout.js, asi que estas pruebas son la red
 * que avisa si alguien cambio el mapa y no volvio a correr el exportador:
 * los puntos de referencia (spawn, misiones, vendedores) tienen que seguir
 * cayendo en piso caminable.
 */
class FloorGridTest {

    private final FloorGrid floor = FloorGrid.floor1();

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
    @DisplayName("todas las zonas de mision son alcanzables")
    void missionZonesAreWalkable() {
        MissionCatalog.ZONES.forEach(zone ->
                assertTrue(floor.isWalkable(zone.x(), zone.y()),
                        "la mision " + zone.missionId() + " quedo dentro de una pared"));
    }

    @Test
    @DisplayName("los vendedores son alcanzables")
    void vendorsAreWalkable() {
        ShopCatalog.VENDORS.forEach(vendor ->
                assertTrue(floor.isWalkable(vendor.x(), vendor.y()),
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
    @DisplayName("un zombi no atraviesa una pared persiguiendo al jugador")
    void zombiesDoNotWalkThroughWalls() {
        // Zombi en el corredor central, objetivo al otro lado de la pared de
        // arriba: la componente vertical tiene que quedar bloqueada.
        Zombie zombie = new Zombie("z1", 800, 736, 2, 150);
        double startY = zombie.getY();

        for (int i = 0; i < 120; i++) {
            zombie.step(floor, 800, 0, 0, 0, 0.066, 0);
        }

        assertTrue(floor.fits(zombie.getX(), zombie.getY(), 12),
                "el zombi termino dentro de una pared");
        assertTrue(zombie.getY() <= startY, "deberia haber avanzado hacia arriba o quedarse");
    }
}
