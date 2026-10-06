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
    private final ScheduledExecutorService gameLoop = Executors.newScheduledThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "game-loop");
        thread.setDaemon(true);
        return thread;
    });

    private final BossConfig bossConfig;
    private final co.eci.operaciongaravito.history.MatchHistoryService history;

    public GameSessionService(
            SimpMessagingTemplate messagingTemplate,
            co.eci.operaciongaravito.history.MatchHistoryService history,
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
        this.history = history;
        this.bossConfig = new BossConfig(detectionRadiusTiles, attackRadiusTiles, repathMs, alertMs, stunMs,
                loseTargetMs, speedPxPerSecond, maxHealth, biteDamage, attackCooldownMs);
    }

    // Metricas (Micrometer): salas, jugadores y zombis en vivo, cuanto tarda el tick de
    // una sala y cuantos mensajes se mandan completos o livianos. Llegan por setter para
    // que las pruebas que arman el servicio a mano no las necesiten.
    private io.micrometer.core.instrument.Timer tickTimer;
    private io.micrometer.core.instrument.Counter fullMessages;
    private io.micrometer.core.instrument.Counter deltaMessages;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setMeterRegistry(io.micrometer.core.instrument.MeterRegistry registry) {
        registry.gauge("garavito.rooms", sessions, Map::size);
        registry.gauge("garavito.players", sessions,
                all -> all.values().stream().mapToInt(GameSession::playerCount).sum());
        registry.gauge("garavito.zombies", sessions,
                all -> all.values().stream().mapToInt(GameSession::zombieCount).sum());
        tickTimer = io.micrometer.core.instrument.Timer.builder("garavito.tick")
                .description("Duracion del tick de una sala")
                .publishPercentiles(0.5, 0.99)
                .register(registry);
        fullMessages = registry.counter("garavito.messages", "kind", "full");
        deltaMessages = registry.counter("garavito.messages", "kind", "delta");
    }

    private static final long TICK_PERIOD_MS = 66;
    private static final long BROADCAST_PERIOD_MS = 125;
    private static final java.util.Set<String> FULL_STATE_EVENTS = java.util.Set.of("LOBBY_OK", "JOIN_OK", "REJOIN_OK");
    /** Un codificador de mensajes livianos por sala (ver DeltaEncoder). */
    private final Map<String, DeltaEncoder> encoders = new ConcurrentHashMap<>();

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
            GameSession fresh = new GameSession(id, building, bossConfig);
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
            encoders.remove(gameId);
        }
    }

    /**
     * Se cayo una conexion: el jugador NO sale de la sala enseguida. Se le guarda el
     * puesto {@link GameSession#RECONNECT_GRACE_MS} para que pueda volver (/rejoin)
     * con su rol, inventario y misiones; si no vuelve, el tick lo saca.
     */
    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Seat seat = seatsByConnection.remove(event.getSessionId());
        if (seat == null) {
            return;
        }
        GameSession session = sessions.get(seat.gameId());
        if (session == null) {
            return;
        }
        session.markDisconnected(seat.role(), System.currentTimeMillis());
        broadcast(seat.gameId(), session, null);
    }

    /** Vuelve a su puesto quien se desconecto, desde una conexion nueva. */
    public String rejoin(String gameId, String role, String token, String connectionId) {
        GameSession session = sessions.get(gameId);
        if (session == null) {
            return "lobby_not_found";
        }
        String rejection = session.rejoin(role, token);
        if (rejection == null) {
            seatsByConnection.values().removeIf(seat -> seat.gameId().equals(gameId) && seat.role().equals(role));
            registerSeat(connectionId, gameId, role);
        }
        return rejection;
    }

    private void expireSeats(String gameId, GameSession session, long now) {
        for (String role : session.expiredSeats(now)) {
            LOGGER.log(System.Logger.Level.INFO, "se libera el puesto de " + role + " en " + gameId);
            leave(gameId, role);
        }
    }

    public void broadcast(String gameId, GameSession session, LastEvent lastEvent) {
        // Al entrar o volver alguien va el estado completo: llega sin nada de antes.
        boolean forceFull = lastEvent != null && FULL_STATE_EVENTS.contains(lastEvent.type());
        GameStateMessage message = encoders.computeIfAbsent(gameId, id -> new DeltaEncoder())
                .encode(message(session, lastEvent), forceFull);
        if (fullMessages != null) {
            (message.full() ? fullMessages : deltaMessages).increment();
        }
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message);
    }

    public void broadcastRejected(String gameId, LastEvent event) {
        messagingTemplate.convertAndSend("/topic/game/" + gameId, GameStateMessage.eventOnly(event));
    }

    private GameStateMessage message(GameSession session, LastEvent lastEvent) {
        return new GameStateMessage(
                session.playerStates(),
                session.claimedItemIdsSnapshot(),
                lastEvent,
                session.zombieStates(),
                session.waveState(),
                session.doorStates(),
                session.lobbyState(),
                session.bossView(),
                session.projectileStates(),
                session.barricadeStates(),
                session.lastSummary(),
                session.kinderEvent(),
                session.puddleStates()
        );
    }

    private void startTicking(String gameId) {
        long[] lastTickAt = { System.currentTimeMillis() };
        long[] lastBroadcastAt = { 0 };

        gameLoop.scheduleAtFixedRate(() -> {
            GameSession session = sessions.get(gameId);
            if (session == null) {
                throw new IllegalStateException("partida cerrada");
            }

            expireSeats(gameId, session, System.currentTimeMillis());
            if (!sessions.containsKey(gameId)) {
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

                if (tickTimer != null) {
                    tickTimer.record(() -> session.tick(now, deltaSeconds));
                } else {
                    session.tick(now, deltaSeconds);
                }
                for (MatchSummary summary = session.pollSummaryToSave(); summary != null; summary = session.pollSummaryToSave()) {
                    history.saveAsync(summary);
                }

                if (now - lastBroadcastAt[0] >= BROADCAST_PERIOD_MS) {
                    lastBroadcastAt[0] = now;
                    LastEvent event = session.consumeWipedRun() ? LastEvent.teamWiped()
                            : session.consumeVictory() ? LastEvent.victory() : session.pollEvent();
                    broadcast(gameId, session, event);
                }
            } catch (RuntimeException ex) {

                LOGGER.log(System.Logger.Level.WARNING, "fallo el tick de la partida " + gameId, ex);
            }
        }, TICK_PERIOD_MS, TICK_PERIOD_MS, java.util.concurrent.TimeUnit.MILLISECONDS);
    }
}
