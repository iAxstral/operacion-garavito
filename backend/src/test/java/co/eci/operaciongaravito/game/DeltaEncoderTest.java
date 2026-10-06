package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class DeltaEncoderTest {

    private static final String[] ROLES = { "SEGURIDAD", "SALUD", "ECONOMIA", "INFRAESTRUCTURA" };

    private GameSession session;
    private DeltaEncoder encoder;

    @BeforeEach
    void setUp() {
        session = new GameSession("DELT", Building.F, BossConfig.defaults());
        for (String role : ROLES) {
            session.joinPlayer(role, "t");
        }
        session.start(ROLES[0]);
        session.tick(System.currentTimeMillis(), 0.066);
        encoder = new DeltaEncoder();
    }

    private GameStateMessage full() {
        return new GameStateMessage(session.playerStates(), session.claimedItemIdsSnapshot(), null,
                session.zombieStates(), session.waveState(), session.doorStates(), session.lobbyState(), session.bossView(),
                session.projectileStates(), session.barricadeStates(), session.lastSummary(), session.kinderEvent(),
                session.puddleStates());
    }

    @Test
    @DisplayName("el primero va completo y el siguiente omite lo que no cambio")
    void omitsUnchangedParts() {
        GameStateMessage first = encoder.encode(full(), false);
        assertTrue(first.full());
        assertNotNull(first.doors());

        GameStateMessage second = encoder.encode(full(), false);
        assertFalse(second.full());
        assertNull(second.doors());
        assertNull(second.lobby());
        assertTrue(second.unchanged().containsAll(List.of("doors", "lobby", "claimedItemIds", "barricades")));
        assertTrue(second.players().stream().allMatch(PlayerState::staticOmitted));
        assertTrue(second.players().stream().allMatch(p -> p.missions() == null && p.inventory() == null));
        assertEquals(4, second.players().size(), "las posiciones y la vida siguen viajando");
    }

    @Test
    @DisplayName("lo que cambia vuelve a viajar: un apodo nuevo y una puerta que se abre")
    void sendsWhatChanged() {
        encoder.encode(full(), false);
        session.setPlayerName("SALUD", "Ana");
        GameStateMessage message = encoder.encode(full(), false);
        PlayerState medic = message.players().stream().filter(p -> p.playerId().equals("SALUD")).findFirst().orElseThrow();
        assertFalse(medic.staticOmitted());
        assertEquals("Ana", medic.name());
        assertTrue(message.players().stream().filter(p -> !p.playerId().equals("SALUD")).allMatch(PlayerState::staticOmitted));
    }

    @Test
    @DisplayName("cada 16 mensajes, y al entrar alguien, va el estado completo")
    void keyframes() {
        encoder.encode(full(), false);
        for (int i = 1; i < DeltaEncoder.KEYFRAME_EVERY; i++) {
            assertFalse(encoder.encode(full(), false).full(), "mensaje " + i);
        }
        assertTrue(encoder.encode(full(), false).full());
        assertTrue(encoder.encode(full(), true).full(), "forzado");
    }

    @Test
    @DisplayName("el mensaje liviano pesa mucho menos que el completo")
    void lighterOnTheWire() {
        JsonMapper json = JsonMapper.builder().build();
        int fullBytes = json.writeValueAsBytes(encoder.encode(full(), false)).length;
        int deltaBytes = json.writeValueAsBytes(encoder.encode(full(), false)).length;
        System.out.printf("estado completo %d B, liviano %d B (%.0f%% menos)%n", fullBytes, deltaBytes,
                100.0 * (fullBytes - deltaBytes) / fullBytes);
        assertTrue(deltaBytes < fullBytes * 0.6, "completo " + fullBytes + " B, liviano " + deltaBytes + " B");
    }
}
