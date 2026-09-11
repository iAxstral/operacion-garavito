package co.eci.operaciongaravito.game;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * Endpoints STOMP de vida/inventario. Todo se difunde por el mismo
 * /topic/game/{gameId} (un solo canal por partida, tambien usado a futuro
 * por el RoundCoordinator) — nunca un topic separado por tipo de evento.
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

    private void broadcast(String gameId, GameSession session, LastEvent lastEvent) {
        GameStateMessage message = new GameStateMessage(
                session.playerStates(),
                session.claimedItemIdsSnapshot(),
                lastEvent
        );
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message);
    }
}
