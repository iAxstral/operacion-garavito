package co.eci.operaciongaravito.game;

import static co.eci.operaciongaravito.security.Entrada.CLIENT_ID;
import static co.eci.operaciongaravito.security.Entrada.CONSTANTE;
import static co.eci.operaciongaravito.security.Entrada.ID;
import static co.eci.operaciongaravito.security.Entrada.TOKEN;
import static co.eci.operaciongaravito.security.Entrada.cumple;
import static co.eci.operaciongaravito.security.Entrada.finitos;
import static co.eci.operaciongaravito.security.Entrada.opcional;

import co.eci.operaciongaravito.security.Entrada;
import co.eci.operaciongaravito.security.IpHandshakeInterceptor;
import co.eci.operaciongaravito.security.LimiteSalas;
import co.eci.operaciongaravito.security.Rechazos;
import co.eci.operaciongaravito.security.SecurityProperties;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.converter.MessageConversionException;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.invocation.MethodArgumentResolutionException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

/**
 * Mensajes STOMP del juego. Cada accion se atribuye al puesto ligado a la conexion
 * (nunca al playerId del mensaje) y antes de tocar la sala se valida el formato de lo
 * que llega (ver {@link Entrada}); lo invalido se descarta y se cuenta en
 * garavito.rejected. Los rechazos de entrada (sala, puesto) se responden solo a quien
 * los causo, por su cola privada.
 */
@Controller
public class GameController {

    private static final System.Logger LOGGER = System.getLogger(GameController.class.getName());

    private final GameSessionService sessionService;
    private final SecurityProperties security;
    private final LimiteSalas limiteSalas;
    private final Rechazos rechazos;

    /** Para pruebas armadas a mano: limites por defecto y sin metricas. */
    public GameController(GameSessionService sessionService) {
        this(sessionService, new SecurityProperties(), null, null);
    }

    @Autowired
    public GameController(GameSessionService sessionService, SecurityProperties security, LimiteSalas limiteSalas,
            Rechazos rechazos) {
        this.sessionService = sessionService;
        this.security = security;
        this.limiteSalas = limiteSalas == null ? new LimiteSalas(security) : limiteSalas;
        this.rechazos = rechazos;
    }

    private void contar(String reason) {
        if (rechazos != null) {
            rechazos.contar(reason);
        }
    }

    /** Descarta un cuerpo invalido: lo cuenta y devuelve true para cortar el metodo. */
    private boolean invalido(boolean ok) {
        if (!ok) {
            contar(Rechazos.BAD_PAYLOAD);
        }
        return !ok;
    }

    private static String ipDe(SimpMessageHeaderAccessor headers) {
        Map<String, Object> attributes = headers.getSessionAttributes();
        Object ip = attributes == null ? null : attributes.get(IpHandshakeInterceptor.IP_ATTRIBUTE);
        return ip == null ? null : ip.toString();
    }

    private static boolean lobbyValido(LobbyRequest request) {
        return request != null && cumple(CLIENT_ID, request.clientId())
                && opcional(CONSTANTE, request.building()) && opcional(CONSTANTE, request.mode());
    }

    /** Pide una sala nueva: el servidor genera el codigo y se lo responde solo a quien la pidio. */
    @MessageMapping("/game/create")
    public void createRoom(CreateRoomRequest request, SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(CLIENT_ID, request.clientId())
                && opcional(CONSTANTE, request.building()) && opcional(CONSTANTE, request.mode()))) {
            return;
        }
        String connection = headers.getSessionId();
        if (sessionService.atRoomCap() || !limiteSalas.permitir(connection, ipDe(headers))) {
            contar(Rechazos.ROOM_CAP);
            sessionService.reply(connection, LastEvent.lobbyRejected(request.clientId(), "room_cap"));
            return;
        }
        String code = sessionService.createWithServerCode(Building.parseOrDefault(request.building()),
                GameMode.parseOrDefault(request.mode()));
        if (code == null) {
            contar(Rechazos.ROOM_CAP);
            sessionService.reply(connection, LastEvent.lobbyRejected(request.clientId(), "room_cap"));
            return;
        }
        sessionService.reply(connection, LastEvent.lobbyCreated(request.clientId(), code));
    }

    @MessageMapping("/game/{gameId}/lobby")
    public void lobby(@DestinationVariable String gameId, LobbyRequest request, SimpMessageHeaderAccessor headers) {
        if (invalido(lobbyValido(request))) {
            return;
        }
        String connection = headers.getSessionId();
        GameSession session;
        if (!GameSessionService.isValidCode(gameId)) {
            sessionService.reply(connection, LastEvent.lobbyRejected(request.clientId(), "invalid_code"));
            return;
        }
        if (request.create()) {
            // El codigo lo genera el servidor (/app/game/create). Elegirlo el cliente solo
            // queda para las pruebas de carga (perfil carga), con los mismos topes.
            if (!security.getRooms().isClientCodesAllowed()) {
                sessionService.reply(connection, LastEvent.lobbyRejected(request.clientId(), "use_create"));
                return;
            }
            if (sessionService.atRoomCap() || !limiteSalas.permitir(connection, ipDe(headers))) {
                contar(Rechazos.ROOM_CAP);
                sessionService.reply(connection, LastEvent.lobbyRejected(request.clientId(), "room_cap"));
                return;
            }
            session = sessionService.create(gameId, Building.parseOrDefault(request.building()),
                    GameMode.parseOrDefault(request.mode()));
            if (session == null) {
                sessionService.reply(connection, LastEvent.lobbyRejected(request.clientId(), "code_taken"));
                return;
            }
        } else {
            session = sessionService.find(gameId);
            if (session == null) {
                String owner = sessionService.redirectFor(gameId);
                sessionService.reply(connection, owner != null
                        ? LastEvent.lobbyRedirect(request.clientId(), owner)
                        : LastEvent.lobbyRejected(request.clientId(), "lobby_not_found"));
                return;
            }
        }
        sessionService.broadcast(gameId, session, LastEvent.lobbyOk(request.clientId()));
    }

    private boolean asientoValido(JoinRequest request) {
        return request != null && cumple(CONSTANTE, request.role()) && cumple(CLIENT_ID, request.clientId())
                && Entrada.nombre(request.name()) && opcional(CONSTANTE, request.costume());
    }

    @MessageMapping("/game/{gameId}/join")
    public void join(@DestinationVariable String gameId, JoinRequest request, SimpMessageHeaderAccessor headers) {
        if (invalido(asientoValido(request))) {
            return;
        }
        String connection = headers.getSessionId();
        if (!opcional(TOKEN, request.token())) {
            contar(Rechazos.BAD_TOKEN);
            sessionService.reply(connection, LastEvent.joinRejected(request.clientId(), "bad_token"));
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            sessionService.reply(connection, LastEvent.joinRejected(request.clientId(), "lobby_not_found"));
            return;
        }
        // Una conexion, un puesto: si no, un solo cliente llena la sala y nadie mas juega.
        // Se reserva de forma atomica: los join de una conexion pueden llegar en paralelo.
        if (!sessionService.reserveSeat(connection, gameId, request.role())) {
            contar(Rechazos.SEAT_CAP);
            sessionService.reply(connection, LastEvent.joinRejected(request.clientId(), "already_seated"));
            return;
        }

        String rejection = session.joinPlayer(request.role(), request.token());
        if (rejection != null) {
            sessionService.releaseSeat(connection, gameId, request.role());
            sessionService.reply(connection, LastEvent.joinRejected(request.clientId(), rejection));
            return;
        }
        session.setPlayerName(request.role(), request.name());
        session.setPlayerCostume(request.role(), request.costume());
        sessionService.broadcast(gameId, session, LastEvent.joinOk(request.role(), request.clientId()));
    }

    @MessageMapping("/game/{gameId}/rejoin")
    public void rejoin(@DestinationVariable String gameId, JoinRequest request, SimpMessageHeaderAccessor headers) {
        if (invalido(asientoValido(request))) {
            return;
        }
        String connection = headers.getSessionId();
        if (!cumple(TOKEN, request.token())) {
            contar(Rechazos.BAD_TOKEN);
            sessionService.reply(connection, LastEvent.rejoinRejected(request.clientId(), "bad_token"));
            return;
        }
        String rejection = sessionService.rejoin(gameId, request.role(), request.token(), connection);
        if (rejection != null) {
            if ("bad_token".equals(rejection)) {
                contar(Rechazos.BAD_TOKEN);
            }
            sessionService.reply(connection, LastEvent.rejoinRejected(request.clientId(), rejection));
            return;
        }
        GameSession session = sessionService.find(gameId);
        session.setPlayerName(request.role(), request.name());
        session.setPlayerCostume(request.role(), request.costume());
        sessionService.broadcast(gameId, session, LastEvent.rejoinOk(request.role(), request.clientId()));
    }

    /**
     * Cuerpo que no se pudo leer (JSON roto, vacio, tipos imposibles) o que hizo fallar un
     * metodo: se cuenta y se descarta sin volcar la traza al log por cada intento.
     */
    @MessageExceptionHandler
    public void onBadMessage(Exception ex) {
        contar(Rechazos.BAD_PAYLOAD);
        if (ex instanceof MessageConversionException || ex instanceof MethodArgumentResolutionException
                || ex instanceof IllegalArgumentException) {
            LOGGER.log(System.Logger.Level.DEBUG, "mensaje STOMP descartado: " + ex.getClass().getSimpleName());
        } else {
            LOGGER.log(System.Logger.Level.WARNING, "fallo un mensaje STOMP: " + ex);
        }
    }

    @MessageMapping("/game/{gameId}/perk")
    public void choosePerk(@DestinationVariable String gameId, PerkRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(CONSTANTE, request.perk()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptChoosePerk(playerId, request.perk());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/hide")
    public void hide(@DestinationVariable String gameId, PlayerRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null)) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptHide(playerId, System.currentTimeMillis());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/chat")
    public void chat(@DestinationVariable String gameId, ChatRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(CONSTANTE, request.phrase()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        LastEvent event = session.attemptChat(playerId, request.phrase(), System.currentTimeMillis());
        if (event != null) {
            broadcast(gameId, session, event);
        }
    }

    @MessageMapping("/game/{gameId}/ping")
    public void ping(@DestinationVariable String gameId, PingRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(CONSTANTE, request.kind()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        LastEvent event = session.attemptPing(playerId, request.kind(), System.currentTimeMillis());
        if (event != null) {
            broadcast(gameId, session, event);
        }
    }

    @MessageMapping("/game/{gameId}/start")
    public void start(@DestinationVariable String gameId, StartRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null)) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session != null && session.start(playerId)) {
            sessionService.broadcast(gameId, session, null);
        }
    }

    @MessageMapping("/game/{gameId}/leave")
    public void leave(@DestinationVariable String gameId, LeaveRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null)) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        sessionService.leave(gameId, playerId);
    }

    @MessageMapping("/game/{gameId}/pickup")
    public void pickup(@DestinationVariable String gameId, PickupRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.itemId()) && finitos(request.x(), request.y()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PickupResult result = session.attemptPickup(playerId, request.itemId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.pickupSuccess(playerId, request.itemId())
                : LastEvent.pickupRejected(playerId, request.itemId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/purchase")
    public void purchase(@DestinationVariable String gameId, PurchaseRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.itemId()) && finitos(request.x(), request.y()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PurchaseResult result = session.attemptPurchase(playerId, request.itemId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.purchaseSuccess(playerId, request.itemId())
                : LastEvent.purchaseRejected(playerId, request.itemId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/door/toggle")
    public void toggleDoor(@DestinationVariable String gameId, DoorToggleRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.doorId()) && finitos(request.x(), request.y()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        DoorToggleResult result = session.attemptToggleDoor(
                playerId, request.doorId(), request.x(), request.y());

        LastEvent event = result.success()
                ? null
                : LastEvent.doorRejected(playerId, request.doorId(), result.reason());
        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/mission/start")
    public void startMission(@DestinationVariable String gameId, MissionStartRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.missionId()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        MissionResult result = session.attemptStartMission(playerId, request.missionId());

        LastEvent event = result.success()
                ? LastEvent.missionStarted(playerId, request.missionId())
                : LastEvent.missionRejected(playerId, request.missionId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/mission/cancel")
    public void cancelMission(@DestinationVariable String gameId, MissionStartRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.missionId()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        session.attemptCancelMission(playerId, request.missionId());
        broadcast(gameId, session, LastEvent.missionCancelled(playerId, request.missionId()));
    }

    @MessageMapping("/game/{gameId}/mission/complete")
    public void completeMission(@DestinationVariable String gameId, MissionCompleteRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.missionId()) && finitos(request.x(), request.y()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        MissionResult result = session.attemptCompleteMission(playerId, request.missionId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.missionSuccess(playerId, request.missionId())
                : LastEvent.missionRejected(playerId, request.missionId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/move")
    public void move(@DestinationVariable String gameId, MoveRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && Entrada.piso(request.floor()) && finitos(request.x(), request.y()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session != null
                && !session.reportPosition(playerId, request.floor(), request.x(), request.y())
                && session.shouldCorrect(playerId)) {
            broadcast(gameId, session, LastEvent.positionCorrected(playerId));
        }
    }

    @MessageMapping("/game/{gameId}/attack")
    public void attack(@DestinationVariable String gameId, AttackRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && finitos(request.x(), request.y(), request.facing()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        AttackResult result = session.attemptAttack(
                playerId, request.type() == null ? AttackType.BASIC : request.type(),
                request.x(), request.y(), request.facing());

        if (result.kills() > 0 || !result.success()) {
            LastEvent event = result.success()
                    ? LastEvent.attackKill(playerId, result.kills())
                    : LastEvent.attackRejected(playerId, result.reason());
            broadcast(gameId, session, event);
        }
    }

    @MessageMapping("/game/{gameId}/use")
    public void useItem(@DestinationVariable String gameId, UseItemRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.itemId()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        UseItemResult result = session.attemptUseItem(playerId, request.itemId());

        LastEvent event = result.success()
                ? LastEvent.useSuccess(playerId, request.itemId())
                : LastEvent.useRejected(playerId, request.itemId(), result.reason());
        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/equip")
    public void equip(@DestinationVariable String gameId, EquipRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.itemId()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptEquip(playerId, request.itemId());
        broadcast(gameId, session, result.success()
                ? null
                : LastEvent.equipRejected(playerId, request.itemId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/reload")
    public void reload(@DestinationVariable String gameId, PlayerRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null)) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptReload(playerId);
        broadcast(gameId, session, result.success() ? null : LastEvent.reloadRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/revive/start")
    public void startRevive(@DestinationVariable String gameId, ReviveRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(CONSTANTE, request.targetId()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptReviveStart(playerId, request.targetId());
        broadcast(gameId, session, result.success()
                ? null
                : LastEvent.reviveRejected(playerId, request.targetId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/revive/cancel")
    public void cancelRevive(@DestinationVariable String gameId, PlayerRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null)) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session != null) {
            session.attemptReviveCancel(playerId);
            broadcast(gameId, session, null);
        }
    }

    @MessageMapping("/game/{gameId}/event/interact")
    public void interactEvent(@DestinationVariable String gameId, PlayerRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null)) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptEventInteract(playerId);
        // El exito lo anuncia el tick (EVENT_RESOLVED); aqui solo el rechazo.
        broadcast(gameId, session, result.success() ? session.pollEvent() : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/barricade/place")
    public void placeBarricade(@DestinationVariable String gameId, BarricadeRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && finitos(request.x(), request.y(), request.facing()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptPlaceBarricade(playerId, request.x(), request.y(), request.facing());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/barricade/repair")
    public void repairBarricade(@DestinationVariable String gameId, BarricadeRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.barricadeId()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptRepairBarricade(playerId, request.barricadeId());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/barricade/dismantle")
    public void dismantleBarricade(@DestinationVariable String gameId, BarricadeRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(ID, request.barricadeId()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptDismantleBarricade(playerId, request.barricadeId());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/transfer")
    public void transfer(@DestinationVariable String gameId, TransferRequest request,
            SimpMessageHeaderAccessor headers) {
        if (invalido(request != null && cumple(CONSTANTE, request.targetId()))) {
            return;
        }
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptTransfer(playerId, request.targetId(), request.amount());
        broadcast(gameId, session, result.success()
                ? LastEvent.transfer(playerId, request.targetId(), request.amount())
                : LastEvent.abilityRejected(playerId, result.reason()));
    }

    private void broadcast(String gameId, GameSession session, LastEvent lastEvent) {
        sessionService.broadcast(gameId, session, lastEvent);
    }
}
