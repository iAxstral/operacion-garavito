package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class EstadoTest {

    private GameSessionService service;
    private EstadoController controller;

    @BeforeEach
    void setUp() {
        service = new GameSessionService(mock(SimpMessagingTemplate.class), null, 8, 1, 500, 600, 1500, 3000, 115, 24, 12, 900);
        controller = new EstadoController(service);
    }

    @Test
    @DisplayName("sin salas el estado esta en cero")
    void emptyServer() {
        EstadoServidor estado = controller.estado();

        assertEquals(0, estado.salas());
        assertEquals(0, estado.jugadores());
        assertTrue(estado.partidas().isEmpty());
        assertEquals("local", estado.nodo());
        assertNull(estado.tickP99Ms(), "sin registro de metricas no hay tick");
    }

    @Test
    @DisplayName("cuenta salas y jugadores, y pone primero la sala mas llena")
    void countsRoomsAndPlayers() {
        GameSession biblioteca = service.create("BIBL01", Building.BIBLIOTECA);
        biblioteca.joinPlayer("SEGURIDAD");
        GameSession edificioF = service.create("EDIF01", Building.F);
        edificioF.joinPlayer("SEGURIDAD");
        edificioF.joinPlayer("SALUD");
        edificioF.joinPlayer("ECONOMIA");
        edificioF.start("SEGURIDAD");

        EstadoServidor estado = controller.estado();

        assertEquals(2, estado.salas());
        assertEquals(4, estado.jugadores());
        EstadoServidor.SalaEnVivo primera = estado.partidas().get(0);
        assertEquals("F", primera.edificio());
        assertEquals(3, primera.jugadores());
        assertTrue(primera.enCurso());
        EstadoServidor.SalaEnVivo segunda = estado.partidas().get(1);
        assertEquals("BIBLIOTECA", segunda.edificio());
        assertFalse(segunda.enCurso());
    }

    @Test
    @DisplayName("no expone los codigos de sala")
    void doesNotLeakRoomCodes() {
        service.create("SECRETO", Building.F).joinPlayer("SALUD");

        String json = controller.estado().toString();

        assertFalse(json.contains("SECRETO"));
    }

    @Test
    @DisplayName("con metricas reporta el p99 del tick")
    void reportsTickWithMetrics() {
        service.setMeterRegistry(new SimpleMeterRegistry());

        assertNotNull(controller.estado().tickP99Ms());
    }
}
