package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TemporadaTest {

    private static SimpMessageHeaderAccessor connection(String id) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
        headers.setSessionId(id);
        return headers;
    }

    private final GameSessionService service =
            new GameSessionService(mock(SimpMessagingTemplate.class), null, 8, 1, 500, 600, 1500, 3000, 115, 24, 12, 900);

    @Test
    @DisplayName("una temporada desconocida o ausente es Navidad")
    void defaultsToChristmas() {
        assertEquals(Temporada.NAVIDAD, Temporada.parseOrDefault(null));
        assertEquals(Temporada.NAVIDAD, Temporada.parseOrDefault("pascua"));
        assertEquals(Temporada.HALLOWEEN, Temporada.parseOrDefault(" halloween "));
    }

    @Test
    @DisplayName("la sala guarda la temporada con que se creo y la publica en el lobby")
    void roomKeepsItsSeason() {
        GameController controller = new GameController(service);
        controller.lobby("HALLO1", new LobbyRequest("c1", true, "F", "NORMAL", "HALLOWEEN"));
        controller.lobby("NAVID1", new LobbyRequest("c2", true, "F", "NORMAL", null));

        assertEquals(Temporada.HALLOWEEN, service.find("HALLO1").lobbyState().temporada());
        assertEquals(Temporada.NAVIDAD, service.find("NAVID1").lobbyState().temporada());
    }

    @Test
    @DisplayName("quien entra a una sala existente no le cambia la temporada")
    void joiningDoesNotChangeSeason() {
        GameController controller = new GameController(service);
        controller.lobby("HALLO2", new LobbyRequest("c1", true, "F", "NORMAL", "HALLOWEEN"));
        controller.lobby("HALLO2", new LobbyRequest("c2", false, null, null, "NAVIDAD"));
        controller.join("HALLO2", new JoinRequest("SALUD", "c2", "t2", null, null), connection("conn-2"));

        assertEquals(Temporada.HALLOWEEN, service.find("HALLO2").lobbyState().temporada());
    }
}
