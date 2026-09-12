package co.eci.operaciongaravito.game;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Registro en memoria de partidas activas, por gameId. Tambien es el dueño
 * del scheduler compartido que usan los {@link RoundCoordinator} de cada
 * sesion para el timeout de ronda, y de la logica de broadcast cuando una
 * ronda se resuelve — incluido el caso de timeout, que dispara desde un
 * hilo del scheduler sin que ningun mensaje STOMP haya llegado en ese
 * instante (por eso GameController no puede ser quien lo difunda).
 */
@Service
public class GameSessionService {

    private final Map<String, GameSession> sessions = new ConcurrentHashMap<>();
    private final SimpMessagingTemplate messagingTemplate;
    private final ScheduledExecutorService roundTimeoutScheduler = Executors.newScheduledThreadPool(2, runnable -> {
        Thread thread = new Thread(runnable, "round-timeout");
        thread.setDaemon(true);
        return thread;
    });

    public GameSessionService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public GameSession getOrCreate(String gameId) {
        return sessions.computeIfAbsent(gameId,
                id -> new GameSession(id, roundTimeoutScheduler, round -> broadcastRoundResolved(id, round)));
    }

    private void broadcastRoundResolved(String gameId, RoundState round) {
        GameSession session = sessions.get(gameId);
        if (session == null) {
            return;
        }
        GameStateMessage message = new GameStateMessage(
                session.playerStates(),
                session.claimedItemIdsSnapshot(),
                null,
                round
        );
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message);
    }
}
