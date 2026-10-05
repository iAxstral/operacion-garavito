package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MovementValidationTest {

    private static final double SPAWN_X = 608;
    private static final double SPAWN_Y = 800;

    private GameSession session;
    private Player player;

    @BeforeEach
    void setUp() {
        session = new GameSession("mov", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD");
        session.start("SEGURIDAD");
        player = session.getOrCreatePlayer("SEGURIDAD");
        // Primer reporte en el spawn: desde ahi se mide todo.
        assertTrue(session.reportPosition("SEGURIDAD", 1, SPAWN_X, SPAWN_Y));
    }

    @Test
    @DisplayName("caminar un paso normal se acepta")
    void normalStepIsAccepted() {
        assertTrue(session.reportPosition("SEGURIDAD", 1, SPAWN_X + 16, SPAWN_Y));
        assertEquals(SPAWN_X + 16, player.getX());
    }

    @Test
    @DisplayName("teletransportarse lejos se rechaza y el jugador queda donde estaba")
    void teleportIsRejected() {
        assertFalse(session.reportPosition("SEGURIDAD", 1, SPAWN_X + 900, SPAWN_Y));
        assertEquals(SPAWN_X, player.getX());
        assertEquals(1, player.getRejectedMoves());
    }

    @Test
    @DisplayName("aunque haya estado quieto, no puede saltar mas que medio segundo de camino")
    void idleDoesNotAllowJumps() {
        player.setLastMoveAt(System.currentTimeMillis() - 10_000);
        assertFalse(session.reportPosition("SEGURIDAD", 1, SPAWN_X, SPAWN_Y - 350));
    }

    @Test
    @DisplayName("no se puede caminar dentro de una pared")
    void wallsAreSolid() {
        FloorGrid grid = FloorGrid.forFloor(Building.F, 1);
        double y = SPAWN_Y;
        while (grid.isWalkable(SPAWN_X, y) || grid.isWalkable(SPAWN_X, y + GameSession.FOOT_OFFSET_PX)) {
            y -= 8;
        }
        // Un punto dentro de pared cercano (al alcance por velocidad) igual se rechaza.
        player.setLastMoveAt(System.currentTimeMillis() - 2_000);
        assertFalse(session.isValidMove(player, 1, SPAWN_X, y - 4, System.currentTimeMillis()));
    }

    @Test
    @DisplayName("cambiar de piso solo vale por la escalera")
    void floorChangesNeedTheStairs() {
        assertFalse(session.reportPosition("SEGURIDAD", 2, SPAWN_X, SPAWN_Y), "aparecer en otro piso desde el vestibulo");

        FloorGrid.StairsSpec up = FloorGrid.forFloor(Building.F, 1).stairs("up");
        FloorGrid.StairsSpec arrival = FloorGrid.forFloor(Building.F, 2).stairs("down");
        player.reportPosition(1, up.x() + up.w() / 2, up.y() + up.h() / 2);
        assertTrue(session.reportPosition("SEGURIDAD", 2, arrival.arrivalX(), arrival.arrivalY()));
        assertEquals(2, player.getFloor());

        assertFalse(session.reportPosition("SEGURIDAD", 3, SPAWN_X, SPAWN_Y), "subir sin estar en la escalera");
    }

    @Test
    @DisplayName("las acciones usan la posicion del servidor, no la que manda el cliente")
    void actionsUseTheServerPosition() {
        ShopVendor machine = ShopCatalog.WEAPON_MACHINE;
        player.addGaravitos(100);
        PurchaseResult remote = session.attemptPurchase("SEGURIDAD", "shop-hacha", machine.x(), machine.y());
        assertEquals("too_far", remote.reason(), "decir que esta junto a la maquina no alcanza");
    }

    @Test
    @DisplayName("solo se avisa la correccion cada cierto tiempo")
    void correctionsAreRateLimited() {
        assertTrue(session.shouldCorrect("SEGURIDAD"));
        assertFalse(session.shouldCorrect("SEGURIDAD"));
    }
}
