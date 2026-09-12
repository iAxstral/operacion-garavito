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

    private static final System.Logger LOGGER = System.getLogger(GameSessionService.class.getName());

    private final Map<String, GameSession> sessions = new ConcurrentHashMap<>();
    private final SimpMessagingTemplate messagingTemplate;
    private final ScheduledExecutorService roundTimeoutScheduler = Executors.newScheduledThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "game-loop");
        thread.setDaemon(true);
        return thread;
    });

    public GameSessionService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Simulacion a 15 Hz y broadcast a 8 Hz. Se separan porque el cliente
     * interpola entre paquetes: mandar los 15 no se nota en pantalla y casi
     * duplica el trafico (ver GAMEPLAY.md).
     */
    private static final long TICK_PERIOD_MS = 66;
    private static final long BROADCAST_PERIOD_MS = 125;

    public GameSession getOrCreate(String gameId) {
        // El tick se agenda dentro del computeIfAbsent para garantizar
        // exactamente uno por partida. La tarea agendada no toca el mapa (solo
        // lo lee, 66 ms despues), que es la restriccion real de
        // ConcurrentHashMap sobre la funcion de mapeo.
        return sessions.computeIfAbsent(gameId, id -> {
            GameSession session = new GameSession(id, roundTimeoutScheduler, round -> broadcastRoundResolved(id, round));
            startTicking(id);
            return session;
        });
    }

    private void startTicking(String gameId) {
        long[] lastTickAt = { System.currentTimeMillis() };
        long[] lastBroadcastAt = { 0 };

        roundTimeoutScheduler.scheduleAtFixedRate(() -> {
            GameSession session = sessions.get(gameId);
            if (session == null) {
                return;
            }
            // Una partida sin nadie adentro no se simula: el tick sigue
            // agendado pero no cuesta nada hasta que alguien entra.
            if (!session.hasPlayers()) {
                lastTickAt[0] = System.currentTimeMillis();
                return;
            }

            try {
                long now = System.currentTimeMillis();
                // Delta real y no el periodo nominal: si el scheduler se
                // atrasa, los zombis avanzan lo que corresponde al tiempo
                // transcurrido en vez de quedarse en camara lenta.
                double deltaSeconds = Math.min(0.25, (now - lastTickAt[0]) / 1000.0);
                lastTickAt[0] = now;

                session.tick(now, deltaSeconds);

                if (now - lastBroadcastAt[0] >= BROADCAST_PERIOD_MS) {
                    lastBroadcastAt[0] = now;
                    broadcastTick(gameId, session);
                }
            } catch (RuntimeException ex) {
                // Una excepcion no capturada aca cancelaria el schedule para
                // siempre y la partida quedaria congelada sin ninguna señal.
                LOGGER.log(System.Logger.Level.WARNING, "fallo el tick de la partida " + gameId, ex);
            }
        }, TICK_PERIOD_MS, TICK_PERIOD_MS, java.util.concurrent.TimeUnit.MILLISECONDS);
    }

    private void broadcastTick(String gameId, GameSession session) {
        GameStateMessage message = new GameStateMessage(
                session.playerStates(),
                session.claimedItemIdsSnapshot(),
                null,
                session.currentRoundView(),
                session.zombieStates(),
                session.waveState()
        );
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message);
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
                round,
                session.zombieStates(),
                session.waveState()
        );
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message);
    }
}
