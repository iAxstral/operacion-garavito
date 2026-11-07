package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** NaN / Infinity en las coordenadas que manda el cliente. */
class CoordenadasNoFinitasTest {

    @Test
    @DisplayName("Jackson convierte los textos \"NaN\" e \"Infinity\" (y 1e400) en doubles no finitos")
    void jacksonAcceptsNonFiniteNumbers() {
        JsonMapper mapper = JsonMapper.builder().build();
        AttackRequest nan = mapper.readValue(
                "{\"playerId\":\"SEGURIDAD\",\"type\":\"BASIC\",\"x\":\"NaN\",\"y\":\"Infinity\",\"facing\":1e400}",
                AttackRequest.class);
        assertTrue(Double.isNaN(nan.x()), "x = " + nan.x());
        assertTrue(Double.isInfinite(nan.y()), "y = " + nan.y());
        assertTrue(Double.isInfinite(nan.facing()), "facing = " + nan.facing());
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("un golpe con x/y/facing NaN no le pega a zombis lejanos ni a la espalda")
    void nanAttackDoesNotHitFarZombies() throws Exception {
        GameSession session = new GameSession("NAN", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD");
        session.start("SEGURIDAD");
        Player player = session.getOrCreatePlayer("SEGURIDAD");
        java.lang.reflect.Field field = GameSession.class.getDeclaredField("zombies");
        field.setAccessible(true);
        Map<String, Zombie> zombies = (Map<String, Zombie>) field.get(session);
        for (int i = 0; i < 6; i++) {
            zombies.put("z" + i, new Zombie("z" + i, player.getFloor(), player.getX() + 400 + 40 * i, player.getY() - 300, 1, 1));
        }

        AttackResult result = session.attemptAttack("SEGURIDAD", AttackType.BASIC, Double.NaN, Double.NaN, Double.NaN);

        assertFalse(result.success() && result.kills() > 0, "mato " + result.kills() + " zombis lejanos con NaN");
        assertEquals(6, zombies.values().stream().filter(Zombie::isAlive).count());
    }
}
