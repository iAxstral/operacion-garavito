package co.eci.operaciongaravito.game;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
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
    private final java.util.concurrent.ScheduledThreadPoolExecutor gameLoop =
            new java.util.concurrent.ScheduledThreadPoolExecutor(4, runnable -> {
                Thread thread = new Thread(runnable, "game-loop");
                thread.setDaemon(true);
                return thread;
            });
    /** La tarea de tick de cada sala: se cancela al cerrar la sala (no queda programada). */
    private final Map<String, ScheduledFuture<?>> tickers = new ConcurrentHashMap<>();

    {
        // Una tarea cancelada sale de la cola enseguida, no cuando le tocaria correr.
        gameLoop.setRemoveOnCancelPolicy(true);
    }

    /** Topes de salas (security.rooms.*). Sin Spring (pruebas armadas a mano), los de por defecto. */
    private co.eci.operaciongaravito.security.SecurityProperties security =
            new co.eci.operaciongaravito.security.SecurityProperties();
    private final java.security.SecureRandom random = new java.security.SecureRandom();
    /** Sin ambiguos (0/O, 1/I): se dictan en voz alta en clase. */
    static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setSecurity(co.eci.operaciongaravito.security.SecurityProperties security) {
        this.security = security;
    }

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

    // Varios nodos (ver cluster/): que nodo tiene cada sala y la URL publica de este.
    // Sin perfil cluster, un registro en memoria y nunca hay a donde redirigir.
    private co.eci.operaciongaravito.cluster.RoomRegistry roomRegistry =
            new co.eci.operaciongaravito.cluster.InMemoryRoomRegistry();
    private String nodeUrl = "local";
    private static final long REGISTRY_REFRESH_MS = 30_000;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setRoomRegistry(co.eci.operaciongaravito.cluster.RoomRegistry registry) {
        this.roomRegistry = registry;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setNodeUrl(@Value("${app.node.public-url:local}") String url) {
        this.nodeUrl = url;
    }

    /** URL del nodo que tiene la sala si no es este, o null (la sala esta aqui o no existe). */
    public String redirectFor(String gameId) {
        if (sessions.containsKey(gameId)) {
            return null;
        }
        String owner = roomRegistry.ownerOf(gameId);
        return owner != null && !owner.equals(nodeUrl) ? owner : null;
    }

    private static final long TICK_PERIOD_MS = 66;
    private static final long BROADCAST_PERIOD_MS = 125;
    private static final java.util.Set<String> FULL_STATE_EVENTS = java.util.Set.of("LOBBY_OK", "JOIN_OK", "REJOIN_OK");
    /** Un codificador de mensajes livianos por sala (ver DeltaEncoder). */
    private final Map<String, DeltaEncoder> encoders = new ConcurrentHashMap<>();

    /** Cuantas tareas de tick hay programadas (para comprobar que no quedan salas zombi). */
    public int scheduledTasks() {
        return gameLoop.getQueue().size();
    }

    public static boolean isValidCode(String gameId) {
        return gameId != null && VALID_CODE.matcher(gameId).matches();
    }

    public GameSession find(String gameId) {
        return sessions.get(gameId);
    }

    public GameSession create(String gameId, Building building) {
        return create(gameId, building, GameMode.NORMAL);
    }

    /** True si este nodo ya tiene el maximo de salas (security.rooms.max-per-node). */
    public boolean atRoomCap() {
        return sessions.size() >= security.getRooms().getMaxPerNode();
    }

    /**
     * Crea una sala con un codigo que genera el servidor (SecureRandom, sin que el
     * cliente lo elija). Devuelve el codigo, o null si el nodo esta lleno.
     */
    public String createWithServerCode(Building building, GameMode mode) {
        int length = security.getRooms().getCodeLength();
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder code = new StringBuilder(length);
            for (int i = 0; i < length; i++) {
                code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            if (atRoomCap()) {
                return null;
            }
            if (create(code.toString(), building, mode) != null) {
                return code.toString();
            }
        }
        return null;
    }

    public GameSession create(String gameId, Building building, GameMode mode) {
        if (!isValidCode(gameId) || atRoomCap()) {
            return null;
        }
        // Con varios nodos, el codigo puede estar tomado en otro.
        if (!roomRegistry.claim(gameId, nodeUrl)) {
            return null;
        }
        boolean[] created = { false };
        GameSession session = sessions.computeIfAbsent(gameId, id -> {
            created[0] = true;
            GameSession fresh = new GameSession(id, building, bossConfig, Difficulty.forMode(mode));
            startTicking(id);
            return fresh;
        });
        return created[0] ? session : null;
    }

    /** Foto de este nodo para GET /api/estado: salas mas llenas primero, sin sus codigos. */
    public EstadoServidor estado() {
        java.util.List<EstadoServidor.SalaEnVivo> partidas = new java.util.ArrayList<>();
        for (GameSession session : sessions.values()) {
            // Con el candado de la sala, igual que el estado que se manda a los jugadores.
            synchronized (session) {
                WaveState wave = session.waveState();
                partidas.add(new EstadoServidor.SalaEnVivo(session.getBuilding().name(), session.playerCount(),
                        session.zombieCount(), session.isStarted(), wave.number(), wave.total(), wave.bossStage()));
            }
        }
        partidas.sort(java.util.Comparator.comparingInt(EstadoServidor.SalaEnVivo::jugadores).reversed());
        Double tickP99Ms = null;
        if (tickTimer != null) {
            for (io.micrometer.core.instrument.distribution.ValueAtPercentile value
                    : tickTimer.takeSnapshot().percentileValues()) {
                if (value.percentile() == 0.99) {
                    tickP99Ms = value.value(java.util.concurrent.TimeUnit.MILLISECONDS);
                }
            }
        }
        return new EstadoServidor(
                nodeUrl,
                java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime() / 1000,
                partidas.size(),
                partidas.stream().mapToInt(EstadoServidor.SalaEnVivo::jugadores).sum(),
                partidas.stream().mapToInt(EstadoServidor.SalaEnVivo::zombis).sum(),
                tickP99Ms,
                partidas);
    }

    /**
     * Reserva el puesto {@code role} de la sala para esta conexion si todavia no ocupa
     * ninguno (en ninguna sala). Atomico: dos join en paralelo no ocupan dos puestos.
     */
    public boolean reserveSeat(String connectionId, String gameId, String role) {
        return connectionId != null && seatsByConnection.putIfAbsent(connectionId, new Seat(gameId, role)) == null;
    }

    /** Suelta la reserva si el join no prospero (rol tomado, rol invalido). */
    public void releaseSeat(String connectionId, String gameId, String role) {
        if (connectionId != null) {
            seatsByConnection.remove(connectionId, new Seat(gameId, role));
        }
    }

    public void registerSeat(String connectionId, String gameId, String role) {
        if (connectionId != null) {
            seatsByConnection.put(connectionId, new Seat(gameId, role));
        }
    }

    /**
     * Rol que ocupa esta conexion en la sala, o null si no esta sentada en ella. Las
     * acciones usan esto y no el playerId del mensaje, que el cliente puede falsear.
     */
    public String seatRole(String gameId, String connectionId) {
        Seat seat = connectionId == null ? null : seatsByConnection.get(connectionId);
        return seat != null && seat.gameId().equals(gameId) ? seat.role() : null;
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
            closeRoom(gameId);
        }
    }

    /** Borra la sala: deja de existir, se libera su codigo y se cancela su tick. */
    private void closeRoom(String gameId) {
        sessions.remove(gameId);
        encoders.remove(gameId);
        roomRegistry.release(gameId, nodeUrl);
        ScheduledFuture<?> ticker = tickers.remove(gameId);
        if (ticker != null) {
            ticker.cancel(false);
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

    /**
     * Responde solo a la conexion {@code connectionId} (su cola /user/queue/eventos):
     * rechazos y el codigo de la sala nueva. Asi el topic de una sala no confirma si un
     * codigo existe ni muestra el clientId de quien pregunto.
     */
    public void reply(String connectionId, LastEvent event) {
        if (connectionId == null || messagingTemplate == null) {
            return;
        }
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(connectionId);
        headers.setLeaveMutable(true);
        messagingTemplate.convertAndSendToUser(connectionId, "/queue/eventos", GameStateMessage.eventOnly(event),
                headers.getMessageHeaders());
    }

    private GameStateMessage message(GameSession session, LastEvent lastEvent) {
        // Se arma con el candado de la sala: asi no se cruza con un tick o una accion a medias.
        synchronized (session) {
            return buildMessage(session, lastEvent);
        }
    }

    private GameStateMessage buildMessage(GameSession session, LastEvent lastEvent) {
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
        ).withBlasts(session.blastStates()).withTravesuras(session.travesurasState());
    }

    private void startTicking(String gameId) {
        long[] lastTickAt = { System.currentTimeMillis() };
        long[] lastBroadcastAt = { 0 };
        long[] lastRegistryRefresh = { System.currentTimeMillis() };
        long[] emptySince = { System.currentTimeMillis() };

        ScheduledFuture<?> ticker = gameLoop.scheduleAtFixedRate(() -> {
            GameSession session = sessions.get(gameId);
            if (session == null) {
                closeRoom(gameId);
                return;
            }

            expireSeats(gameId, session, System.currentTimeMillis());
            if (System.currentTimeMillis() - lastRegistryRefresh[0] >= REGISTRY_REFRESH_MS) {
                lastRegistryRefresh[0] = System.currentTimeMillis();
                roomRegistry.refresh(gameId, nodeUrl);
            }
            if (!sessions.containsKey(gameId)) {
                closeRoom(gameId);
                return;
            }
            if (!session.hasPlayers()) {
                // Una sala que se creo y nadie uso (o que quedo vacia) no vive para siempre.
                if (System.currentTimeMillis() - emptySince[0] >= security.getRooms().getEmptyTtlMs()) {
                    LOGGER.log(System.Logger.Level.INFO, "se borra la sala vacia " + gameId);
                    closeRoom(gameId);
                    return;
                }
                lastTickAt[0] = System.currentTimeMillis();
                return;
            }
            emptySince[0] = System.currentTimeMillis();
            if (!session.isStarted()) {
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
        tickers.put(gameId, ticker);
    }
}
