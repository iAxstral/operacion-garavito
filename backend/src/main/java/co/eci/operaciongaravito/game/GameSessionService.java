package co.eci.operaciongaravito.game;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Service
public class GameSessionService {

    private static final System.Logger LOGGER = System.getLogger(GameSessionService.class.getName());
    private static final Pattern VALID_CODE = Pattern.compile("[A-Z0-9]{4,8}");

    private record Seat(String gameId, String role) {
    }

    private final Map<String, GameSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, Seat> seatsByConnection = new ConcurrentHashMap<>();
    private final SimpMessagingTemplate messagingTemplate;
    private final ScheduledExecutorService roundTimeoutScheduler = Executors.newScheduledThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "game-loop");
        thread.setDaemon(true);
        return thread;
    });

    private final BossConfig bossConfig;

    public GameSessionService(
            SimpMessagingTemplate messagingTemplate,
            @Value("${game.boss.detection-radius-tiles:8}") double detectionRadiusTiles,
            @Value("${game.boss.attack-radius-tiles:1}") double attackRadiusTiles,
            @Value("${game.boss.repath-ms:500}") long repathMs,
            @Value("${game.boss.alert-ms:600}") long alertMs,
            @Value("${game.boss.stun-ms:1500}") long stunMs,
            @Value("${game.boss.lose-target-ms:3000}") long loseTargetMs,
            @Value("${game.boss.speed-px-per-second:115}") double speedPxPerSecond,
            @Value("${game.boss.max-health:24}") int maxHealth,
            @Value("${game.boss.bite-damage:12}") int biteDamage,
            @Value("${game.boss.attack-cooldown-ms:900}") long attackCooldownMs) {
        this.messagingTemplate = messagingTemplate;
        this.bossConfig = new BossConfig(detectionRadiusTiles, attackRadiusTiles, repathMs, alertMs, stunMs,
                loseTargetMs, speedPxPerSecond, maxHealth, biteDamage, attackCooldownMs);
    }

    private static final long TICK_PERIOD_MS = 66;
    private static final long BROADCAST_PERIOD_MS = 125;

    public static boolean isValidCode(String gameId) {
        return gameId != null && VALID_CODE.matcher(gameId).matches();
    }

    public GameSession find(String gameId) {
        return sessions.get(gameId);
    }

    public GameSession create(String gameId, Building building) {
        if (!isValidCode(gameId)) {
            return null;
        }
        boolean[] created = { false };
        GameSession session = sessions.computeIfAbsent(gameId, id -> {
            created[0] = true;
            GameSession fresh = new GameSession(id, building, bossConfig, roundTimeoutScheduler,
                    round -> broadcastRoundResolved(id, round));
            startTicking(id);
            return fresh;
        });
        return created[0] ? session : null;
    }

    public void registerSeat(String connectionId, String gameId, String role) {
        if (connectionId != null) {
            seatsByConnection.put(connectionId, new Seat(gameId, role));
        }
    }

    public void leave(String gameId, String role) {
        GameSession session = sessions.get(gameId);
        if (session == null) {
            return;
        }
        session.removePlayer(role);
        seatsByConnection.values().removeIf(seat -> seat.gameId().equals(gameId) && seat.role().equals(role));
        if (session.hasPlayers()) {
            broadcast(gameId, session, null);
        } else {
            sessions.remove(gameId);
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Seat seat = seatsByConnection.remove(event.getSessionId());
        if (seat != null) {
            leave(seat.gameId(), seat.role());
        }
    }

    public void broadcast(String gameId, GameSession session, LastEvent lastEvent) {
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message(session, lastEvent, session.currentRoundView()));
    }

    public void broadcastRejected(String gameId, LastEvent event) {
        messagingTemplate.convertAndSend("/topic/game/" + gameId, GameStateMessage.eventOnly(event));
    }

    private GameStateMessage message(GameSession session, LastEvent lastEvent, RoundState round) {
        return new GameStateMessage(
                session.playerStates(),
                session.claimedItemIdsSnapshot(),
                lastEvent,
                round,
                session.zombieStates(),
                session.waveState(),
                session.doorStates(),
                session.lobbyState(),
                session.bossView()
        );
    }

    private void startTicking(String gameId) {
        long[] lastTickAt = { System.currentTimeMillis() };
        long[] lastBroadcastAt = { 0 };

        roundTimeoutScheduler.scheduleAtFixedRate(() -> {
            GameSession session = sessions.get(gameId);
            if (session == null) {
                throw new IllegalStateException("partida cerrada");
            }

            if (!session.hasPlayers() || !session.isStarted()) {
                lastTickAt[0] = System.currentTimeMillis();
                return;
            }

            try {
                long now = System.currentTimeMillis();

                double deltaSeconds = Math.min(0.25, (now - lastTickAt[0]) / 1000.0);
                lastTickAt[0] = now;

                session.tick(now, deltaSeconds);

                if (now - lastBroadcastAt[0] >= BROADCAST_PERIOD_MS) {
                    lastBroadcastAt[0] = now;
                    LastEvent event = session.consumeWipedRun() ? LastEvent.teamWiped()
                            : session.consumeVictory() ? LastEvent.victory() : null;
                    broadcast(gameId, session, event);
                }
            } catch (RuntimeException ex) {

                LOGGER.log(System.Logger.Level.WARNING, "fallo el tick de la partida " + gameId, ex);
            }
        }, TICK_PERIOD_MS, TICK_PERIOD_MS, java.util.concurrent.TimeUnit.MILLISECONDS);
    }

    private void broadcastRoundResolved(String gameId, RoundState round) {
        GameSession session = sessions.get(gameId);
        if (session == null) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message(session, null, round));
    }
}
