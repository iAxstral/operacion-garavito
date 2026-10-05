package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AcidPuddleTest {

    @Test
    @DisplayName("el charco daña de a poco a quien esta encima y no a quien esta lejos")
    void hurtsOnlyPlayersInside() {
        Player inside = new Player("SEGURIDAD");
        inside.reportPosition(1, 500, 500);
        Player outside = new Player("SALUD");
        outside.reportPosition(1, 500 + AcidPuddle.RADIUS_PX + 20, 500);
        AcidPuddle puddle = new AcidPuddle("p1", 1, 500, 500, 0);

        assertTrue(puddle.step(List.of(inside, outside), 0));
        assertEquals(100 - AcidPuddle.DAMAGE, inside.getHealth());
        assertTrue(puddle.step(List.of(inside, outside), AcidPuddle.HURT_EVERY_MS / 2));
        assertEquals(100 - AcidPuddle.DAMAGE, inside.getHealth(), "no daña dos veces seguidas");
        assertTrue(puddle.step(List.of(inside, outside), AcidPuddle.HURT_EVERY_MS));
        assertEquals(100 - 2 * AcidPuddle.DAMAGE, inside.getHealth());
        assertEquals(100, outside.getHealth());
    }

    @Test
    @DisplayName("el charco se seca y no daña en otro piso")
    void expiresAndRespectsFloor() {
        Player upstairs = new Player("SEGURIDAD");
        upstairs.reportPosition(2, 500, 500);
        AcidPuddle puddle = new AcidPuddle("p1", 1, 500, 500, 0);
        assertTrue(puddle.step(List.of(upstairs), 10));
        assertEquals(100, upstairs.getHealth());
        assertFalse(puddle.step(List.of(upstairs), AcidPuddle.LIFETIME_MS));
    }
}
