package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

/** Las acciones se atribuyen al puesto de la conexion, no al playerId que manda el cliente. */
class SeatOwnershipTest {

    private static final String ROOM = "SEAT01";

    private GameSessionService service;
    private GameController controller;
    private GameSession session;
    private int ecoStart;
    private int segStart;

    private static SimpMessageHeaderAccessor connection(String id) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
        headers.setSessionId(id);
        return headers;
    }

    @BeforeEach
    void setUp() {
        service = new GameSessionService(mock(SimpMessagingTemplate.class), null, 8, 1, 500, 600, 1500, 3000, 115, 24, 12, 900);
        controller = new GameController(service);
        session = service.create(ROOM, Building.F);
        controller.join(ROOM, new JoinRequest("ECONOMIA", "c1", "t1", "Eco", null), connection("conn-eco"));
        controller.join(ROOM, new JoinRequest("SEGURIDAD", "c2", "t2", "Seg", null), connection("conn-seg"));
        session.getOrCreatePlayer("ECONOMIA").addGaravitos(50);
        ecoStart = session.getOrCreatePlayer("ECONOMIA").getGaravitos();
        segStart = session.getOrCreatePlayer("SEGURIDAD").getGaravitos();
    }

    @Test
    @DisplayName("nadie puede gastar la plata de Economia haciendose pasar por ella")
    void cannotTransferAsSomeoneElse() {
        controller.transfer(ROOM, new TransferRequest("ECONOMIA", "SEGURIDAD", 50), connection("conn-seg"));

        assertEquals(ecoStart, session.getOrCreatePlayer("ECONOMIA").getGaravitos());
        assertEquals(segStart, session.getOrCreatePlayer("SEGURIDAD").getGaravitos());
    }

    @Test
    @DisplayName("la accion vale para quien de verdad ocupa el puesto")
    void ownerCanAct() {
        controller.transfer(ROOM, new TransferRequest("SEGURIDAD", "SEGURIDAD", 20), connection("conn-eco"));

        // El playerId del mensaje se ignora: transfiere Economia, que es quien envia.
        assertEquals(ecoStart - 20, session.getOrCreatePlayer("ECONOMIA").getGaravitos());
        assertEquals(segStart + 20, session.getOrCreatePlayer("SEGURIDAD").getGaravitos());
    }

    @Test
    @DisplayName("un invitado no puede arrancar la partida como si fuera el anfitrion")
    void guestCannotStartAsHost() {
        controller.start(ROOM, new StartRequest("ECONOMIA"), connection("conn-seg"));
        assertFalse(session.isStarted());

        controller.start(ROOM, new StartRequest(null), connection("conn-eco"));
        assertTrue(session.isStarted());
    }

    @Test
    @DisplayName("una conexion sin puesto no puede sacar a nadie de la sala")
    void strangerCannotKickPlayers() {
        controller.leave(ROOM, new LeaveRequest("SEGURIDAD"), connection("conn-intrusa"));

        assertEquals(2, session.playerCount());
        assertNull(service.seatRole(ROOM, "conn-intrusa"));
        assertEquals("SEGURIDAD", service.seatRole(ROOM, "conn-seg"));
        assertNull(service.seatRole("OTRA", "conn-seg"), "el puesto es solo de su sala");
    }
}
