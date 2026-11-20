package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Puertas del Edificio F, piso 1: f1-aula es la de un salon de arriba (casilla 9,7) y
 * f1-terraza la de uno de abajo (casilla 9,16). Las posiciones son el centro del sprite,
 * como las reporta el cliente; los pies quedan FOOT_OFFSET_PX mas abajo.
 */
class DoorToggleTest {

    private static final double DOOR_X = 9 * FloorGrid.TILE + FloorGrid.TILE / 2.0;

    private GameSession session;
    private Player guard;
    private Player medic;

    @BeforeEach
    void setUp() {
        session = new GameSession("DOOR", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD", "t");
        session.joinPlayer("SALUD", "t");
        guard = session.getOrCreatePlayer("SEGURIDAD");
        medic = session.getOrCreatePlayer("SALUD");
        medic.reportPosition(1, 200, 200);
    }

    private boolean toggle(String doorId) {
        return session.attemptToggleDoor("SEGURIDAD", doorId, guard.getX(), guard.getY()).success();
    }

    private boolean isOpen(String doorId) {
        return session.doorStates().stream().filter(d -> d.doorId().equals(doorId)).findFirst().orElseThrow().open();
    }

    @Test
    @DisplayName("la puerta de un salon de arriba se abre y se cierra desde adentro y desde el pasillo")
    void topRoomDoorWorksFromBothSides() {
        // Pasillo (abajo), a 112 px: hasta ahi avisa el cliente para que la cabeza no
        // tape la puerta.
        guard.reportPosition(1, DOOR_X, 480 + 112 - GameSession.FOOT_OFFSET_PX);
        assertTrue(toggle("f1-aula"));
        assertFalse(isOpen("f1-aula"));

        // Adentro (arriba), pegado a la puerta cerrada: antes quedaba a 95 px del centro
        // de la casilla y el servidor respondia too_far.
        guard.reportPosition(1, DOOR_X, 385);
        assertTrue(toggle("f1-aula"), "desde adentro del salon tambien se abre");
        assertTrue(isOpen("f1-aula"));
    }

    @Test
    @DisplayName("la puerta de un salon de abajo se abre y se cierra desde el pasillo y desde adentro")
    void bottomRoomDoorWorksFromBothSides() {
        // Adentro (abajo), justo donde la puerta cerrada lo frena.
        guard.reportPosition(1, DOOR_X, 1088);
        assertTrue(toggle("f1-terraza"));
        assertFalse(isOpen("f1-terraza"));

        // Pasillo (arriba), pegado a la puerta cerrada: antes respondia too_far.
        guard.reportPosition(1, DOOR_X, 961);
        assertTrue(toggle("f1-terraza"), "desde el pasillo tambien se abre");
        assertTrue(isOpen("f1-terraza"));
    }

    @Test
    @DisplayName("lejos de la puerta o en otro piso no se puede usar")
    void tooFarOrOtherFloor() {
        guard.reportPosition(1, DOOR_X, 280); // pies a 149 px del centro de la casilla
        assertEquals("too_far", session.attemptToggleDoor("SEGURIDAD", "f1-aula", 0, 0).reason());

        guard.reportPosition(2, DOOR_X, 472);
        assertEquals("too_far", session.attemptToggleDoor("SEGURIDAD", "f1-aula", 0, 0).reason());
        assertTrue(isOpen("f1-aula"));
    }

    @Test
    @DisplayName("no se cierra con alguien parado en el marco, pero se puede abrir")
    void cannotCloseOnSomeone() {
        guard.reportPosition(1, DOOR_X, 512);
        medic.reportPosition(1, DOOR_X, 429); // pies dentro de la casilla 9,7
        assertEquals("door_blocked", session.attemptToggleDoor("SEGURIDAD", "f1-aula", 0, 0).reason());
        assertTrue(isOpen("f1-aula"));

        medic.reportPosition(1, DOOR_X, 300);
        assertTrue(toggle("f1-aula"));
        medic.reportPosition(1, DOOR_X, 429);
        assertTrue(toggle("f1-aula"), "abrir con alguien al lado siempre se puede");
        assertTrue(isOpen("f1-aula"));

        // La franja de media casilla debajo del marco tambien cuenta (ahi la puerta
        // cerrada frena en el cliente).
        medic.reportPosition(1, DOOR_X, 512 + 20 - GameSession.FOOT_OFFSET_PX);
        assertEquals("door_blocked", session.attemptToggleDoor("SEGURIDAD", "f1-aula", 0, 0).reason());
        medic.reportPosition(1, DOOR_X, 512 + 40 - GameSession.FOOT_OFFSET_PX);
        assertTrue(toggle("f1-aula"), "mas abajo de la franja ya no estorba");
    }
}
