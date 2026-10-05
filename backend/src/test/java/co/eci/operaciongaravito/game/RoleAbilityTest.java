package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RoleAbilityTest {

    private static final int FLOOR = 2;

    private GameSession session;
    private Player builder;
    private Player treasurer;
    private Player guard;
    private double[] corridor;

    @BeforeEach
    void setUp() {
        session = new GameSession("roles", Building.F, BossConfig.defaults());
        session.joinPlayer("INFRAESTRUCTURA");
        session.joinPlayer("ECONOMIA");
        session.joinPlayer("SEGURIDAD");
        session.start("INFRAESTRUCTURA");
        builder = session.getOrCreatePlayer("INFRAESTRUCTURA");
        treasurer = session.getOrCreatePlayer("ECONOMIA");
        guard = session.getOrCreatePlayer("SEGURIDAD");
        corridor = findCorridor(FloorGrid.forFloor(Building.F, FLOOR), 640);
        builder.reportPosition(FLOOR, corridor[0], corridor[1]);
        treasurer.reportPosition(1, 608, 800);
        guard.reportPosition(1, 700, 800);
    }

    private static double[] findCorridor(FloorGrid grid, double length) {
        for (int row = 1; row * FloorGrid.TILE < grid.pixelHeight(); row++) {
            double y = row * FloorGrid.TILE + FloorGrid.TILE / 2.0;
            double run = 0;
            for (double x = FloorGrid.TILE / 2.0; x < grid.pixelWidth(); x += FloorGrid.TILE) {
                run = grid.isWalkable(x, y) ? run + FloorGrid.TILE : 0;
                if (run >= length) {
                    return new double[] { x - run + FloorGrid.TILE, y };
                }
            }
        }
        throw new AssertionError("sin pasillo recto");
    }

    private FloorGrid sessionGrid() {
        try {
            java.lang.reflect.Field field = GameSession.class.getDeclaredField("floors");
            field.setAccessible(true);
            @SuppressWarnings("unchecked")
            java.util.List<FloorGrid> floors = (java.util.List<FloorGrid>) field.get(session);
            return floors.get(FLOOR - 1);
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Zombie> zombies() {
        try {
            java.lang.reflect.Field field = GameSession.class.getDeclaredField("zombies");
            field.setAccessible(true);
            return (Map<String, Zombie>) field.get(session);
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
    }

    @Test
    @DisplayName("Infraestructura pone una barricada enfrente y bloquea la celda para los zombis")
    void builderPlacesABarricade() {
        assertTrue(session.attemptPlaceBarricade("INFRAESTRUCTURA", corridor[0], corridor[1], 0).success());
        BarricadeState state = session.barricadeStates().get(0);
        double cx = state.col() * FloorGrid.TILE + 32.0;
        assertFalse(sessionGrid().isWalkable(cx, corridor[1]), "la celda quedo bloqueada");
        assertTrue(sessionGrid().isOpenForShots(cx, corridor[1]), "pero las balas pasan por encima");
        assertEquals("on_cooldown", session.attemptPlaceBarricade("INFRAESTRUCTURA", corridor[0] + 128, corridor[1], 0).reason());
    }

    @Test
    @DisplayName("solo Infraestructura pone barricadas")
    void onlyTheBuilderBuilds() {
        guard.reportPosition(FLOOR, corridor[0], corridor[1]);
        assertEquals("wrong_role", session.attemptPlaceBarricade("SEGURIDAD", corridor[0], corridor[1], 0).reason());
    }

    @Test
    @DisplayName("no se puede poner una barricada encima de un compañero")
    void cannotBuildOnAPlayer() {
        guard.reportPosition(FLOOR, corridor[0] + FloorGrid.TILE, corridor[1]);
        assertEquals("blocked_spot", session.attemptPlaceBarricade("INFRAESTRUCTURA", corridor[0], corridor[1], 0).reason());
    }

    @Test
    @DisplayName("los zombis pegados a la barricada la rompen y la celda se libera; repararla la cura")
    void zombiesBreakBarricades() {
        assertTrue(session.attemptPlaceBarricade("INFRAESTRUCTURA", corridor[0], corridor[1], 0).success());
        BarricadeState state = session.barricadeStates().get(0);
        double cx = state.col() * FloorGrid.TILE + 32.0;
        double cy = state.row() * FloorGrid.TILE + 32.0;

        assertTrue(session.attemptRepairBarricade("INFRAESTRUCTURA", state.id()).success());
        builder.reportPosition(FLOOR, cx + 400, cy);
        assertEquals("too_far", session.attemptRepairBarricade("INFRAESTRUCTURA", state.id()).reason());

        zombies().clear();
        for (int i = 0; i < 4; i++) {
            Zombie zombie = new Zombie("zb" + i, FLOOR, cx + 40, cy, 50, 0);
            zombies().put(zombie.getId(), zombie);
        }
        long now = System.currentTimeMillis();
        for (int i = 0; i < 200 && !session.barricadeStates().isEmpty(); i++) {
            now += 66;
            session.tick(now, 0.066);
        }
        assertTrue(session.barricadeStates().isEmpty(), "4 zombis rompen la barricada en unos segundos");
        assertTrue(sessionGrid().isWalkable(cx, cy), "la celda se libera");
    }

    @Test
    @DisplayName("Economia le pasa Garavitos a un compañero en cualquier piso")
    void treasurerTransfers() {
        treasurer.addGaravitos(40);
        assertTrue(session.attemptTransfer("ECONOMIA", "INFRAESTRUCTURA", 15).success());
        assertEquals(25, treasurer.getGaravitos());
        assertEquals(15, builder.getGaravitos());

        assertEquals("insufficient_garavitos", session.attemptTransfer("ECONOMIA", "SEGURIDAD", 100).reason());
        assertEquals("insufficient_garavitos", session.attemptTransfer("ECONOMIA", "SEGURIDAD", -5).reason());
        guard.addGaravitos(10);
        assertEquals("wrong_role", session.attemptTransfer("SEGURIDAD", "ECONOMIA", 5).reason());
    }

    @Test
    @DisplayName("Economia compra con 20% de descuento")
    void treasurerGetsADiscount() {
        assertEquals(28, GameSession.priceFor(treasurer, 35));
        assertEquals(35, GameSession.priceFor(guard, 35));

        ShopVendor machine = ShopCatalog.WEAPON_MACHINE;
        treasurer.reportPosition(machine.floor(), machine.x(), machine.y());
        treasurer.addGaravitos(28);
        assertTrue(session.attemptPurchase("ECONOMIA", "shop-pistola", machine.x(), machine.y()).success());
        assertEquals(0, treasurer.getGaravitos());
    }
}
