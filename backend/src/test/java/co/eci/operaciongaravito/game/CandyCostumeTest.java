package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.random.RandomGenerator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CandyCostumeTest {

    @Test
    @DisplayName("mas o menos un tercio de los zombis suelta dulces y el jefe suelta diez")
    void candyDrops() {
        RandomGenerator random = RandomGenerator.of("L64X128MixRandom");
        int candies = GameSession.candiesFor(3000, 0, random);
        assertTrue(candies > 900 && candies < 1300, "dulces: " + candies);
        assertEquals(GameSession.CANDIES_PER_BOSS, GameSession.candiesFor(0, 1, random));
        assertEquals(0, GameSession.candiesFor(0, 0, random));
    }

    @Test
    @DisplayName("solo se aceptan disfraces que existen y viajan en el estado")
    void costumes() {
        GameSession session = new GameSession("DISF", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD", "t");
        session.setPlayerCostume("SEGURIDAD", "VAMPIRO");
        assertEquals("VAMPIRO", session.playerStates().get(0).costume());
        session.setPlayerCostume("SEGURIDAD", "<script>");
        assertNull(session.playerStates().get(0).costume());
    }

    @Test
    @DisplayName("los dulces de la corrida van en el resumen y se reinician")
    void candiesInSummary() {
        Player player = new Player("SALUD");
        player.addCandies(4);
        assertEquals(4, player.statsSnapshot().candies());
        player.resetStats();
        assertEquals(0, player.getCandies());
    }
}
