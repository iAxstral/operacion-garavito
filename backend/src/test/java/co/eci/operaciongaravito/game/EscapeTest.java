package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EscapeTest {

    @Test
    @DisplayName("quien escapa ya no recibe daño ni lo alcanza la horda al acabarse el tiempo")
    void escapedIsSafe() {
        Player player = new Player("SALUD");
        player.escape();
        assertTrue(player.isEscaped());
        assertFalse(player.takeDamage(30));
        player.collapse();
        assertTrue(player.isAlive());
        assertEquals(100, player.getHealth());
    }

    @Test
    @DisplayName("al acabarse el tiempo, quien no salio cae")
    void notEscapedCollapses() {
        Player player = new Player("SALUD");
        player.collapse();
        assertFalse(player.isAlive());
        assertEquals(0, player.getHealth());
    }

    @Test
    @DisplayName("un caido no puede escapar, y al empezar otra corrida se olvida el escape")
    void downedCannotEscapeAndResetClears() {
        Player downed = new Player("SALUD");
        downed.takeDamage(100);
        downed.escape();
        assertFalse(downed.isEscaped());

        Player out = new Player("SEGURIDAD");
        out.escape();
        out.resetStats();
        assertFalse(out.isEscaped());
    }
}
