package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PingAndNameTest {

    private GameSession session;

    @BeforeEach
    void setUp() {
        session = new GameSession("PING", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD", "t");
        session.getOrCreatePlayer("SEGURIDAD").reportPosition(1, 640, 800);
    }

    @Test
    @DisplayName("el aviso al equipo lleva el tipo y la posicion que tiene el servidor")
    void pingCarriesServerPosition() {
        LastEvent ping = session.attemptPing("SEGURIDAD", "ZOMBIES", 10_000);
        assertNotNull(ping);
        assertEquals("PING", ping.type());
        assertEquals("ZOMBIES", ping.itemId());
        assertEquals("1,640,800", ping.reason());
    }

    @Test
    @DisplayName("tipos desconocidos, jugadores ajenos y avisos seguidos se ignoran")
    void rejectsSpamAndUnknownKinds() {
        assertNull(session.attemptPing("SEGURIDAD", "BAILE", 10_000));
        assertNull(session.attemptPing("NADIE", "HELP", 10_000));
        assertNotNull(session.attemptPing("SEGURIDAD", "HELP", 10_000));
        assertNull(session.attemptPing("SEGURIDAD", "HELP", 10_000 + GameSession.PING_COOLDOWN_MS - 1));
        assertNotNull(session.attemptPing("SEGURIDAD", "HELP", 10_000 + GameSession.PING_COOLDOWN_MS));
    }

    @Test
    @DisplayName("el apodo se limpia, se recorta y viaja en el estado y en el resumen")
    void nameIsSanitized() {
        session.setPlayerName("SEGURIDAD", "  Juan\t\u0007  Pérez el Valiente de la ECI  ");
        String name = session.playerStates().get(0).name();
        assertEquals("Juan Pérez el Va", name);
        assertEquals(name, session.getOrCreatePlayer("SEGURIDAD").statsSnapshot().name());
        session.setPlayerName("SEGURIDAD", "   ");
        assertNull(session.playerStates().get(0).name(), "un apodo en blanco deja el rol");
    }
}
