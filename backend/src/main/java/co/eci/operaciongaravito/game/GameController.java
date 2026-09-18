package co.eci.operaciongaravito.game;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * Endpoints STOMP de vida/inventario y decisiones de ronda. Todo se difunde
 * por el mismo /topic/game/{gameId} — un solo canal por partida, nunca uno
 * separado por tipo de evento.
 *
 * /decide no difunde nada por si mismo: el unico disparador de un
 * broadcast "se resolvio la ronda" es el callback de RoundCoordinator (via
 * GameSessionService), que cubre tanto la resolucion por las 4 decisiones
 * como la resolucion por timeout — asi no hay dos caminos de broadcast
 * distintos para el mismo evento.
 */
@Controller
public class GameController {

    private final GameSessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    public GameController(GameSessionService sessionService, SimpMessagingTemplate messagingTemplate) {
        this.sessionService = sessionService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/game/{gameId}/join")
    public void join(@DestinationVariable String gameId, JoinRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);

        LastEvent event;
        try {
            Player player = session.getOrCreatePlayer(request.role());
            // Reiniciar en cada join (no solo la primera vez) es lo que hace
            // que recargar la pagina reinicie la partida — ver el javadoc de
            // resetGame() sobre por que esto es seguro solo mientras
            // SEGURIDAD siga siendo el unico rol jugable.
            session.resetGame();
            event = LastEvent.joinOk(player.getPlayerId());
        } catch (IllegalArgumentException ex) {
            event = LastEvent.joinRejected("invalid_role");
        }

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/pickup")
    public void pickup(@DestinationVariable String gameId, PickupRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        PickupResult result = session.attemptPickup(request.playerId(), request.itemId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.pickupSuccess(request.playerId(), request.itemId())
                : LastEvent.pickupRejected(request.playerId(), request.itemId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/purchase")
    public void purchase(@DestinationVariable String gameId, PurchaseRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        PurchaseResult result = session.attemptPurchase(request.playerId(), request.itemId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.purchaseSuccess(request.playerId(), request.itemId())
                : LastEvent.purchaseRejected(request.playerId(), request.itemId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/door/toggle")
    public void toggleDoor(@DestinationVariable String gameId, DoorToggleRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        DoorToggleResult result = session.attemptToggleDoor(
                request.playerId(), request.doorId(), request.x(), request.y());

        // Igual que /attack: si no paso nada (rechazo) hay que avisarle a
        // quien pidio el toggle; si funciono, el nuevo estado de la puerta ya
        // viaja en `doors` del broadcast normal, no hace falta un evento aparte.
        LastEvent event = result.success()
                ? null
                : LastEvent.doorRejected(request.playerId(), request.doorId(), result.reason());
        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/mission/start")
    public void startMission(@DestinationVariable String gameId, MissionStartRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        MissionResult result = session.attemptStartMission(request.playerId(), request.missionId());

        LastEvent event = result.success()
                ? LastEvent.missionStarted(request.playerId(), request.missionId())
                : LastEvent.missionRejected(request.playerId(), request.missionId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/mission/cancel")
    public void cancelMission(@DestinationVariable String gameId, MissionStartRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        session.attemptCancelMission(request.playerId(), request.missionId());
        broadcast(gameId, session, LastEvent.missionCancelled(request.playerId(), request.missionId()));
    }

    @MessageMapping("/game/{gameId}/mission/complete")
    public void completeMission(@DestinationVariable String gameId, MissionCompleteRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        MissionResult result = session.attemptCompleteMission(request.playerId(), request.missionId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.missionSuccess(request.playerId(), request.missionId())
                : LastEvent.missionRejected(request.playerId(), request.missionId(), result.reason());

        broadcast(gameId, session, event);
    }

    /**
     * Posicion del jugador. Es el unico mensaje de alta frecuencia (10 Hz por
     * jugador) y por eso NO difunde: responder con un broadcast por cada uno
     * multiplicaria el trafico por el numero de jugadores. Las posiciones
     * viajan en el broadcast del tick.
     */
    @MessageMapping("/game/{gameId}/move")
    public void move(@DestinationVariable String gameId, MoveRequest request) {
        sessionService.getOrCreate(gameId).reportPosition(request.playerId(), request.x(), request.y());
    }

    @MessageMapping("/game/{gameId}/attack")
    public void attack(@DestinationVariable String gameId, AttackRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        AttackResult result = session.attemptAttack(request.playerId(), request.x(), request.y(), request.facing());

        // Un golpe al aire no vale un broadcast: solo se difunde cuando algo
        // cambio para los demas (mato zombis) o cuando hay que avisarle al
        // que golpeo por que no paso nada.
        if (result.kills() > 0 || !result.success()) {
            LastEvent event = result.success()
                    ? LastEvent.attackKill(request.playerId(), result.kills())
                    : LastEvent.attackRejected(request.playerId(), result.reason());
            broadcast(gameId, session, event);
        }
    }

    @MessageMapping("/game/{gameId}/decide")
    public void decide(@DestinationVariable String gameId, DecideRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        try {
            session.submitDecision(request.playerId(), request.action());
        } catch (IllegalArgumentException ex) {
            // Rol invalido: se descarta sin registrar. No hay un evento de
            // rechazo dedicado para /decide todavia (a diferencia de join/
            // pickup) porque el flujo esperado siempre manda un rol valido;
            // se puede agregar si hace falta mas adelante.
        }
        // Sin broadcast aca: si esta decision completa la ronda (o si el
        // timeout la resuelve despues), GameSessionService.broadcastRoundResolved
        // ya se encarga — ver el comentario de clase.
    }

    private void broadcast(String gameId, GameSession session, LastEvent lastEvent) {
        GameStateMessage message = new GameStateMessage(
                session.playerStates(),
                session.claimedItemIdsSnapshot(),
                lastEvent,
                session.currentRoundView(),
                session.zombieStates(),
                session.waveState(),
                session.doorStates()
        );
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message);
    }
}
