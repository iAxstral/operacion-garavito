package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class KinderEventTest {

    private GameSession session;
    private Player builder;
    private Player guard;
    private long now;

    @BeforeEach
    void setUp() throws ReflectiveOperationException {
        session = new GameSession("eventos", Building.F, BossConfig.defaults());
        session.joinPlayer("INFRAESTRUCTURA");
        session.joinPlayer("SEGURIDAD");
        session.start("INFRAESTRUCTURA");
        builder = session.getOrCreatePlayer("INFRAESTRUCTURA");
        guard = session.getOrCreatePlayer("SEGURIDAD");
        builder.reportPosition(1, 608, 800);
        guard.reportPosition(1, 640, 800);

        // Kinder 1 activo de inmediato.
        java.lang.reflect.Field field = GameSession.class.getDeclaredField("waveDirector");
        field.setAccessible(true);
        WaveDirector director = (WaveDirector) field.get(session);
        now = System.currentTimeMillis();
        director.resetRun(now, 0);
        director.update(now, 0, java.util.List.of(builder, guard));
        assertTrue(director.isActive());
    }

    private void standOnEvent(Player player) {
        KinderEvent event = session.kinderEvent();
        player.reportPosition(event.floor(), event.x(), event.y());
    }

    @Test
    @DisplayName("el apagon solo lo arregla Infraestructura, en el tablero")
    void blackoutNeedsTheBuilder() {
        session.forceKinderEvent(KinderEvent.Type.BLACKOUT, now);
        KinderEvent event = session.kinderEvent();
        assertNotNull(event);
        assertEquals(KinderEvent.Type.BLACKOUT, event.type());

        assertEquals("too_far", session.attemptEventInteract("INFRAESTRUCTURA").reason());
        standOnEvent(guard);
        assertEquals("needs_builder", session.attemptEventInteract("SEGURIDAD").reason());
        standOnEvent(builder);
        assertTrue(session.attemptEventInteract("INFRAESTRUCTURA").success());
        assertNull(session.kinderEvent());
    }

    @Test
    @DisplayName("sin Infraestructura viva, cualquiera puede arreglar el apagon")
    void anyoneFixesWithoutABuilder() {
        while (builder.isAlive()) {
            builder.takeDamage(50);
        }
        session.forceKinderEvent(KinderEvent.Type.BLACKOUT, now);
        standOnEvent(guard);
        assertTrue(session.attemptEventInteract("SEGURIDAD").success());
    }

    @Test
    @DisplayName("recoger los suministros paga y cura a todo el equipo")
    void supplyRewardsEveryone() {
        guard.takeDamage(40);
        session.forceKinderEvent(KinderEvent.Type.SUPPLY, now);
        standOnEvent(guard);
        assertTrue(session.attemptEventInteract("SEGURIDAD").success());
        assertEquals(GameSession.SUPPLY_GARAVITOS, guard.getGaravitos());
        assertEquals(GameSession.SUPPLY_GARAVITOS, builder.getGaravitos(), "tambien para el que no fue");
        assertEquals(60 + GameSession.SUPPLY_HEAL, guard.getHealth());
    }

    @Test
    @DisplayName("si nadie recoge los suministros a tiempo llega una horda extra")
    void missedSupplyBringsASurge() {
        session.forceKinderEvent(KinderEvent.Type.SUPPLY, now);
        int before = session.zombieStates().size();
        session.tick(now + GameSession.SUPPLY_MS + 10, 0.066);
        assertNull(session.kinderEvent());
        assertTrue(session.zombieStates().size() >= before + GameSession.SUPPLY_FAIL_SURGE - 2,
                "aparecio la horda (algunos pueden haber sido de la rafaga normal)");
    }

    @Test
    @DisplayName("el apagon se termina solo si nadie lo arregla")
    void blackoutEndsByItself() {
        session.forceKinderEvent(KinderEvent.Type.BLACKOUT, now);
        session.tick(now + GameSession.BLACKOUT_MS + 10, 0.066);
        assertNull(session.kinderEvent());
    }
}
