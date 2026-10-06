package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatTest {

    private GameSession session;

    @BeforeEach
    void setUp() {
        session = new GameSession("CHAT", Building.F, BossConfig.defaults());
        session.joinPlayer("SALUD");
    }

    @Test
    @DisplayName("una frase de la lista llega a todos como evento CHAT")
    void phraseBroadcasts() {
        LastEvent event = session.attemptChat("SALUD", "GRACIAS", 10_000);
        assertNotNull(event);
        assertEquals("CHAT", event.type());
        assertEquals("SALUD", event.playerId());
        assertEquals("GRACIAS", event.itemId());
        assertEquals("CHAT", event.reason());
    }

    @Test
    @DisplayName("los emotes se marcan como EMOTE")
    void emote() {
        assertEquals("EMOTE", session.attemptChat("SALUD", "CALAVERA", 10_000).reason());
    }

    @Test
    @DisplayName("no hay texto libre, ni frases de un jugador que no esta")
    void rejectsUnknown() {
        assertNull(session.attemptChat("SALUD", "hola a todos", 10_000));
        assertNull(session.attemptChat("SALUD", null, 10_000));
        assertNull(session.attemptChat("NADIE", "SI", 10_000));
    }

    @Test
    @DisplayName("no se puede escribir mas de una vez por segundo")
    void cooldown() {
        assertNotNull(session.attemptChat("SALUD", "SI", 10_000));
        assertNull(session.attemptChat("SALUD", "NO", 10_500));
        assertNotNull(session.attemptChat("SALUD", "NO", 11_000));
    }
}
