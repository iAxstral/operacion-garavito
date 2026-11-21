package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.function.BiConsumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.MessageHeaders;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

/**
 * Cada mensaje STOMP del juego pasa por las mismas puertas antes de tocar la sala: el
 * cuerpo tiene que ser valido, la conexion tiene que tener un puesto en esa sala y la
 * sala tiene que existir. Aqui se prueban esas puertas para todos los mensajes y el
 * camino feliz de cada uno con dos jugadores reales.
 */
class GameControllerTest {

    private static final String ROOM = "CTRL01";

    private SimpMessagingTemplate template;
    private GameSessionService service;
    private GameController controller;
    private GameSession session;

    private static SimpMessageHeaderAccessor connection(String id) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
        headers.setSessionId(id);
        return headers;
    }

    @BeforeEach
    void setUp() {
        template = mock(SimpMessagingTemplate.class);
        service = new GameSessionService(template, null, 8, 1, 500, 600, 1500, 3000, 115, 24, 12, 900);
        controller = new GameController(service);
        session = service.create(ROOM, Building.F);
        controller.join(ROOM, new JoinRequest("INFRAESTRUCTURA", "c1", "token-infra-000001", "Infra", null),
                connection("conn-infra"));
        controller.join(ROOM, new JoinRequest("SALUD", "c2", "token-salud-0000002", "Medica", null),
                connection("conn-salud"));
    }

    /** Todos los mensajes que manda un jugador dentro de una sala, con un cuerpo valido. */
    private List<BiConsumer<String, SimpMessageHeaderAccessor>> accionesValidas() {
        Player me = session.getOrCreatePlayer("INFRAESTRUCTURA");
        double x = me.getX();
        double y = me.getY();
        return List.of(
                (room, h) -> controller.choosePerk(room, new PerkRequest("X", "REFUERZO"), h),
                (room, h) -> controller.hide(room, new PlayerRequest("X"), h),
                (room, h) -> controller.chat(room, new ChatRequest("X", "HELP"), h),
                (room, h) -> controller.ping(room, new PingRequest("X", "ZOMBIES"), h),
                (room, h) -> controller.pickup(room, new PickupRequest("X", "cafeteria-food-1", x, y), h),
                (room, h) -> controller.purchase(room, new PurchaseRequest("X", "shop-empanada", x, y), h),
                (room, h) -> controller.toggleDoor(room, new DoorToggleRequest("X", "f1-aula", x, y), h),
                (room, h) -> controller.startMission(room, new MissionStartRequest("X", "m-1"), h),
                (room, h) -> controller.cancelMission(room, new MissionStartRequest("X", "m-1"), h),
                (room, h) -> controller.completeMission(room, new MissionCompleteRequest("X", "m-1", x, y), h),
                (room, h) -> controller.move(room, new MoveRequest("X", 1, x + 5, y), h),
                (room, h) -> controller.attack(room, new AttackRequest("X", AttackType.BASIC, x, y, 0), h),
                (room, h) -> controller.useItem(room, new UseItemRequest("X", "shop-empanada"), h),
                (room, h) -> controller.equip(room, new EquipRequest("X", "shop-pistola"), h),
                (room, h) -> controller.reload(room, new PlayerRequest("X"), h),
                (room, h) -> controller.startRevive(room, new ReviveRequest("X", "SALUD"), h),
                (room, h) -> controller.cancelRevive(room, new PlayerRequest("X"), h),
                (room, h) -> controller.interactEvent(room, new PlayerRequest("X"), h),
                (room, h) -> controller.placeBarricade(room, new BarricadeRequest("X", null, x, y, 0), h),
                (room, h) -> controller.repairBarricade(room, new BarricadeRequest("X", "b-1", x, y, 0), h),
                (room, h) -> controller.dismantleBarricade(room, new BarricadeRequest("X", "b-1", x, y, 0), h),
                (room, h) -> controller.transfer(room, new TransferRequest("X", "SALUD", 1), h));
    }

    /** Los mismos mensajes sin cuerpo: Spring entrega null si el JSON no se pudo leer. */
    private List<BiConsumer<String, SimpMessageHeaderAccessor>> accionesSinCuerpo() {
        return List.of(
                (room, h) -> controller.choosePerk(room, null, h),
                (room, h) -> controller.hide(room, null, h),
                (room, h) -> controller.chat(room, null, h),
                (room, h) -> controller.ping(room, null, h),
                (room, h) -> controller.start(room, null, h),
                (room, h) -> controller.leave(room, null, h),
                (room, h) -> controller.pickup(room, null, h),
                (room, h) -> controller.purchase(room, null, h),
                (room, h) -> controller.toggleDoor(room, null, h),
                (room, h) -> controller.startMission(room, null, h),
                (room, h) -> controller.cancelMission(room, null, h),
                (room, h) -> controller.completeMission(room, null, h),
                (room, h) -> controller.move(room, null, h),
                (room, h) -> controller.attack(room, null, h),
                (room, h) -> controller.useItem(room, null, h),
                (room, h) -> controller.equip(room, null, h),
                (room, h) -> controller.reload(room, null, h),
                (room, h) -> controller.startRevive(room, null, h),
                (room, h) -> controller.cancelRevive(room, null, h),
                (room, h) -> controller.interactEvent(room, null, h),
                (room, h) -> controller.placeBarricade(room, null, h),
                (room, h) -> controller.repairBarricade(room, null, h),
                (room, h) -> controller.dismantleBarricade(room, null, h),
                (room, h) -> controller.transfer(room, null, h),
                (room, h) -> controller.join(room, null, h),
                (room, h) -> controller.rejoin(room, null, h),
                (room, h) -> controller.lobby(room, null, h),
                (room, h) -> controller.createRoom(null, h));
    }

    @Test
    @DisplayName("un mensaje sin cuerpo valido se descarta sin tocar la sala ni responder")
    void invalidPayloadIsDropped() {
        clearInvocations(template);
        accionesSinCuerpo().forEach(accion -> assertDoesNotThrow(() -> accion.accept(ROOM, connection("conn-infra"))));
        assertEquals(2, session.playerCount());
        assertFalse(session.isStarted());
        verify(template, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    @DisplayName("una conexion sin puesto en la sala no puede hacer nada")
    void strangerCannotAct() {
        session.start("INFRAESTRUCTURA");
        Player infra = session.getOrCreatePlayer("INFRAESTRUCTURA");
        double x = infra.getX();
        clearInvocations(template);
        accionesValidas().forEach(accion -> accion.accept(ROOM, connection("conn-intrusa")));
        // Tampoco en una sala que no existe.
        accionesValidas().forEach(accion -> accion.accept("NOEXI1", connection("conn-infra")));
        assertEquals(x, infra.getX());
        // El tick de la sala difunde su estado solo; lo que importa es que nada cambio.
        assertNull(service.seatRole(ROOM, "conn-intrusa"));
    }

    @Test
    @DisplayName("cada mensaje de un jugador sentado llega a la sala y se difunde a todos")
    void seatedPlayerActionsReachTheRoom() {
        controller.start(ROOM, new StartRequest(null), connection("conn-infra"));
        assertTrue(session.isStarted());
        clearInvocations(template);
        accionesValidas().forEach(accion -> assertDoesNotThrow(() -> accion.accept(ROOM, connection("conn-infra"))));
        verify(template, atLeastOnce()).convertAndSend(eq("/topic/game/" + ROOM), any(Object.class));
    }

    @Test
    @DisplayName("moverse actualiza la posicion y un teletransporte se corrige")
    void moveUpdatesPositionAndCorrectsTeleport() {
        controller.start(ROOM, new StartRequest(null), connection("conn-infra"));
        Player infra = session.getOrCreatePlayer("INFRAESTRUCTURA");
        double x = infra.getX();
        controller.move(ROOM, new MoveRequest("SALUD", 1, x + 6, infra.getY()), connection("conn-infra"));
        assertEquals(x + 6, infra.getX(), 0.001);

        controller.move(ROOM, new MoveRequest(null, 1, x + 2000, infra.getY()), connection("conn-infra"));
        assertNotEquals(x + 2000, infra.getX());
        // Coordenadas que no son numeros finitos ni se intentan aplicar.
        controller.move(ROOM, new MoveRequest(null, 1, Double.NaN, infra.getY()), connection("conn-infra"));
        assertEquals(x + 6, infra.getX(), 0.001);
    }

    @Test
    @DisplayName("salir libera el puesto y vuelve a entrar quien trae el token")
    void leaveAndRejoin() {
        controller.leave(ROOM, new LeaveRequest(null), connection("conn-salud"));
        assertEquals(1, session.playerCount());
        assertNull(service.seatRole(ROOM, "conn-salud"));

        controller.join(ROOM, new JoinRequest("SALUD", "c3", "token-salud-0000003", "Otra", null),
                connection("conn-salud-2"));
        assertEquals("SALUD", service.seatRole(ROOM, "conn-salud-2"));
        // Un token con formato invalido se rechaza antes de mirar la sala.
        controller.rejoin(ROOM, new JoinRequest("SALUD", "c3", "x", "Otra", null), connection("conn-salud-3"));
        assertNull(service.seatRole(ROOM, "conn-salud-3"));
        controller.rejoin(ROOM, new JoinRequest("SALUD", "c3", "token-salud-0000003", "Otra", null),
                connection("conn-salud-4"));
        assertEquals("SALUD", service.seatRole(ROOM, "conn-salud-4"));
    }

    @Test
    @DisplayName("sala: el servidor genera el codigo; elegirlo, codigos malos y salas que no existen se rechazan")
    void lobbyRules() {
        controller.createRoom(new CreateRoomRequest("cliente-1", "B", "HARD"), connection("conn-nueva"));
        verify(template, atLeastOnce()).convertAndSendToUser(eq("conn-nueva"), anyString(), any(Object.class),
                any(MessageHeaders.class));

        controller.lobby("ELIJO1", new LobbyRequest("cliente-2", true, "F", null), connection("conn-2"));
        controller.lobby("no valido!", new LobbyRequest("cliente-2", false, "F", null), connection("conn-2"));
        controller.lobby("NOEXI2", new LobbyRequest("cliente-2", false, "F", null), connection("conn-2"));
        assertNull(service.find("ELIJO1"), "con los limites de produccion el cliente no elige el codigo");
        assertNull(service.find("NOEXI2"));

        clearInvocations(template);
        controller.lobby(ROOM, new LobbyRequest("cliente-3", false, null, null), connection("conn-3"));
        verify(template, atLeastOnce()).convertAndSend(eq("/topic/game/" + ROOM), any(Object.class));
        assertNotNull(service.find(ROOM));
    }

    @Test
    @DisplayName("un mensaje que no se puede leer no tumba la conexion")
    void badMessageIsSwallowed() {
        assertDoesNotThrow(() -> controller.onBadMessage(new IllegalArgumentException("json roto")));
    }
}
