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

    @MessageMapping("/game/{gameId}/mission/complete")
    public void completeMission(@DestinationVariable String gameId, MissionCompleteRequest request) {
        GameSession session = sessionService.getOrCreate(gameId);
        MissionResult result = session.attemptCompleteMission(request.playerId(), request.missionId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.missionSuccess(request.playerId(), request.missionId())
                : LastEvent.missionRejected(request.playerId(), request.missionId(), result.reason());

        broadcast(gameId, session, event);
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
                session.currentRoundView()
        );
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message);
    }
}
