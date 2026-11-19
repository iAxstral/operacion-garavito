package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ReconnectTest {

    private static final long T0 = 1_000_000;

    private GameSession session;
    private Player guard;

    @BeforeEach
    void setUp() {
        session = new GameSession("vuelve", Building.F, BossConfig.defaults());
        assertNull(session.joinPlayer("SEGURIDAD", "secreto-1"));
        session.start("SEGURIDAD");
        guard = session.getOrCreatePlayer("SEGURIDAD");
        guard.addGaravitos(40);
        guard.tryAddItem(new InventorySlot(ItemType.WEAPON, "shop-pistola", "Pistola"));
    }

    @Test
    @DisplayName("al desconectarse conserva su puesto, sus cosas y sus misiones")
    void disconnectKeepsTheSeat() {
        session.tick(System.currentTimeMillis(), 0.066);
        List<MissionView> missions = session.missionsOf("SEGURIDAD");
        session.markDisconnected("SEGURIDAD", T0);

        assertFalse(guard.isConnected());
        assertTrue(session.hasPlayers(), "sigue en la sala");
        assertTrue(session.expiredSeats(T0 + 10_000).isEmpty(), "a los 10 s todavia se le guarda el puesto");

        assertNull(session.rejoin("SEGURIDAD", "secreto-1"));
        assertTrue(guard.isConnected());
        assertEquals(40, guard.getGaravitos());
        assertEquals(1, guard.inventorySnapshot().size());
        assertEquals(missions, session.missionsOf("SEGURIDAD"));
    }

    @Test
    @DisplayName("sin el token correcto nadie puede ocupar el puesto de otro")
    void rejoinNeedsTheToken() {
        session.markDisconnected("SEGURIDAD", T0);
        assertEquals("bad_token", session.rejoin("SEGURIDAD", "adivinado"));
        assertEquals("bad_token", session.rejoin("SEGURIDAD", null));
        assertFalse(guard.isConnected());
    }

    @Test
    @DisplayName("pasado el tiempo de gracia el puesto se libera")
    void seatExpires() {
        session.markDisconnected("SEGURIDAD", T0);
        assertEquals(List.of("SEGURIDAD"), session.expiredSeats(T0 + GameSession.RECONNECT_GRACE_MS));
        session.removePlayer("SEGURIDAD");
        assertEquals("seat_expired", session.rejoin("SEGURIDAD", "secreto-1"));
    }

    @Test
    @DisplayName("el estado avisa a los demas que un compañero esta desconectado")
    void stateShowsDisconnection() {
        session.markDisconnected("SEGURIDAD", T0);
        assertFalse(session.playerStates().get(0).connected());
        session.rejoin("SEGURIDAD", "secreto-1");
        assertTrue(session.playerStates().get(0).connected());
    }
}
