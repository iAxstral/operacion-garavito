package co.eci.operaciongaravito.game;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class GameSession {

    private static final double PICKUP_RANGE_PX = 110;
    private static final int FOOD_HEALTH_BONUS = 15;
    private static final double SHOP_RANGE_PX = 110;
    private static final double MISSION_RANGE_PX = 90;
    private static final double DOOR_INTERACT_RANGE_PX = 90;

    private static final int GARAVITOS_PER_ZOMBIE = 1;

    private static final double ATTACK_HALF_ARC_RAD = Math.toRadians(55);

    private static final int CHARGED_DAMAGE = 4;
    private static final double CHARGED_RANGE_PX = 150;
    private static final double CHARGED_KNOCKBACK = 520;
    private static final long CHARGED_COOLDOWN_MS = 6_000;

    /** Radio con el que una bala alcanza a un zombi (centro a la linea del disparo). */
    private static final double BULLET_HIT_RADIUS_PX = 16;
    private static final double TOUGH_BULLET_HIT_RADIUS_PX = 20;
    private static final double BOSS_BULLET_HIT_RADIUS_PX = 30;
    private static final double BULLET_STEP_PX = 8;
    private static final double SEPARATION_RADIUS_PX = 26;
    private static final double SEPARATION_FORCE = 90;

    private static final int REVIVE_HEALTH = 100;

    /** Solo Biomedica revive: a esta distancia del caido, manteniendo durante REVIVE_MS. */
    static final String REVIVER_ROLE = "SALUD";
    static final double REVIVE_RANGE_PX = 80;
    /** Si se aleja mas que esto mientras revive, se corta. */
    static final double REVIVE_BREAK_PX = 120;
    static final long REVIVE_MS = 3_000;
    static final int FIELD_REVIVE_HEALTH = 50;

    /** Economia compra con este descuento. */
    static final String TREASURER_ROLE = "ECONOMIA";
    static final double TREASURER_DISCOUNT = 0.2;

    /** Infraestructura: barricadas. */
    static final String BUILDER_ROLE = "INFRAESTRUCTURA";
    static final int MAX_BARRICADES = 2;
    static final long BARRICADE_COOLDOWN_MS = 15_000;
    static final double BARRICADE_REPAIR_RANGE_PX = 90;
    /** Zombis a esta distancia del centro de una barricada la estan golpeando. */
    static final double BARRICADE_CONTACT_PX = 56;
    static final double BOSS_BARRICADE_CONTACT_PX = 72;

    /** El cuerpo del jefe es grande: los golpes lo alcanzan desde un poco mas lejos. */
    private static final double BOSS_HIT_BONUS_PX = 24;
    private static final int BOSS_REWARD_GARAVITOS = 25;
    /** Si se queda solo en su piso este tiempo, sube o baja a buscar al equipo. */
    private static final long BOSS_RELOCATE_MS = 5_000;

    private final String gameId;
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Map<String, WorldItem> worldItems = WorldItemCatalog.defaultCatalog();
    private final Map<String, String> claimedItems = new ConcurrentHashMap<>();
    private final Map<String, Zombie> zombies = new ConcurrentHashMap<>();
    private final Map<String, AcidProjectile> acids = new ConcurrentHashMap<>();
    private final Map<String, AcidPuddle> puddles = new ConcurrentHashMap<>();
    private long puddleSequence = 0;

    /** Avisos al equipo que se aceptan, y cada cuanto puede mandar uno cada jugador. */
    static final java.util.Set<String> PING_KINDS = java.util.Set.of("ZOMBIES", "HELP", "REVIVE", "GO", "AMMO");
    static final long PING_COOLDOWN_MS = 1_500;

    /** Cuanto puede quedarse escondido en un armario y cuanto espera para volver. */
    static final long HIDE_MAX_MS = 8_000;
    static final long HIDE_COOLDOWN_MS = 12_000;

    static final double CANDY_CHANCE = 1.0 / 3;

    /** Explosion del zombi explosivo: radio, dano a otros zombis y cuanto se ve. */
    static final double BLAST_RADIUS_PX = 95;
    static final int BLAST_ZOMBIE_DAMAGE = 3;
    static final long BLAST_VISIBLE_MS = 500;
    /** Grito: enfurece a los zombis de su piso a esta distancia, por este tiempo. */
    static final double SCREAM_REACH_PX = 700;
    static final long ENRAGE_MS = 6_000;
    /** Zombi ciego: oye a un jugador a esta distancia si hace ruido, y siempre si esta muy cerca. */
    static final double BLIND_HEAR_PX = 520;
    static final double BLIND_TOUCH_PX = 140;
    static final long NOISE_ATTACK_MS = 1_500;
    static final long NOISE_RUN_MS = 800;
    /** Mas rapido que esto entre dos reportes cuenta como correr (hace ruido). */
    static final double NOISY_SPEED_PX_S = 185;
    private final Map<String, BlastState> blasts = new ConcurrentHashMap<>();
    private long blastSequence = 0;
    static final int CANDIES_PER_BOSS = 10;
    private final Map<String, Barricade> barricades = new ConcurrentHashMap<>();
    private long barricadeSequence;
    private final WaveDirector waveDirector;
    private final MissionBoard missionBoard;
    private final BossConfig bossConfig;
    private volatile BossZombie boss;
    private long bossAloneSince;
    private long bossSequence;
    private final Building building;
    private final List<FloorGrid> floors;

    private volatile boolean wipedRun = false;
    private volatile boolean victoryPending = false;
    private volatile long runStartedAt = System.currentTimeMillis();
    private volatile MatchSummary lastSummary;
    private final java.util.Queue<MatchSummary> summariesToSave = new java.util.concurrent.ConcurrentLinkedQueue<>();
    private long summarySequence;
    private final java.util.Queue<LastEvent> pendingEvents = new java.util.concurrent.ConcurrentLinkedQueue<>();
    private volatile boolean started = false;
    private volatile String host;

    /*
     * Validacion de movimiento: el cliente manda su posicion, pero el servidor ya no le
     * cree a ciegas. Velocidad maxima (caminar 160 px/s, con dash un poco mas, mas un
     * margen por la red), que el destino no sea pared y que no atraviese paredes; el
     * cambio de piso solo vale saliendo de la escalera y llegando a la del otro piso.
     */
    static final double MOVE_MAX_SPEED_PX_S = 240;
    static final double MOVE_SLACK_PX = 72;
    static final double MOVE_MAX_GAP_S = 0.5;
    /** El sprite se reporta por su centro; los pies estan mas abajo. */
    static final double FOOT_OFFSET_PX = 51;
    static final double STAIRS_MARGIN_PX = 96;
    static final double STAIRS_ARRIVAL_RADIUS_PX = 220;
    static final long CORRECTION_EVERY_MS = 400;
    /** Una accion (ataque) puede venir con la posicion un poco mas fresca que la del servidor. */
    static final double ACTION_POSITION_TOLERANCE_PX = 48;

    /* Eventos de Kinder (desde el 2): uno por Kinder, en un momento al azar. */
    static final int FIRST_EVENT_KINDER = 2;
    static final long EVENT_MIN_DELAY_MS = 20_000;
    static final long EVENT_MAX_DELAY_MS = 45_000;
    static final long BLACKOUT_MS = 50_000;
    static final long SUPPLY_MS = 40_000;
    static final double EVENT_RANGE_PX = 90;
    static final int SUPPLY_GARAVITOS = 20;
    static final int SUPPLY_HEAL = 25;
    static final int SUPPLY_FAIL_SURGE = 6;

    private record ActiveEvent(String id, KinderEvent.Type type, MissionSite site, long endsAt) {
    }

    private volatile ActiveEvent activeEvent;
    private long nextEventAt;
    private int eventKinder;
    private long eventSequence;

    /** Cuanto se le guarda el puesto a un jugador que se desconecto. */
    public static final long RECONNECT_GRACE_MS = 30_000;
    private final Map<String, String> seatTokens = new ConcurrentHashMap<>();

    // Al arrancar la partida los jugadores tienen que poder hacer sus misiones y comprar
    // recursos antes de que llegue la primera oleada — 4s no alcanzaba para eso.
    private static final long FIRST_WAVE_PREP_MS = 45_000;

    public GameSession(String gameId, Building building, BossConfig bossConfig) {
        this.gameId = gameId;
        this.building = building;
        this.bossConfig = bossConfig;
        this.floors = java.util.stream.IntStream.rangeClosed(1, building.floorCount())
                .mapToObj(floor -> FloorGrid.forFloor(building, floor))
                .toList();

        this.waveDirector = new WaveDirector(System.currentTimeMillis(), FIRST_WAVE_PREP_MS, floors);
        this.missionBoard = new MissionBoard(building, java.util.random.RandomGenerator.getDefault());
    }

    public Building getBuilding() {
        return building;
    }

    /** Para el monitoreo: jugadores en la sala y zombis vivos. */
    public int playerCount() {
        return players.size();
    }

    public int zombieCount() {
        return aliveZombieCount();
    }

    public boolean hasPlayers() {
        return !players.isEmpty();
    }

    public String getGameId() {
        return gameId;
    }

    public Player getOrCreatePlayer(String role) {
        Role.valueOf(role);
        return players.computeIfAbsent(role, Player::new);
    }

    public synchronized String joinPlayer(String role) {
        return joinPlayer(role, null);
    }

    public synchronized String joinPlayer(String role, String token) {
        try {
            Role.valueOf(role);
        } catch (IllegalArgumentException | NullPointerException ex) {
            return "invalid_role";
        }
        if (players.containsKey(role)) {
            return "role_taken";
        }
        getOrCreatePlayer(role);
        if (token != null && !token.isBlank()) {
            seatTokens.put(role, token);
        }
        if (host == null) {
            host = role;
        }
        return null;
    }

    public synchronized void removePlayer(String role) {
        players.remove(role);
        seatTokens.remove(role);
        missionBoard.remove(role);
        if (role.equals(host)) {
            host = players.keySet().stream().sorted().findFirst().orElse(null);
        }
    }

    public synchronized boolean start(String playerId) {
        if (playerId == null || !playerId.equals(host)) {
            return false;
        }
        if (!started) {
            resetGame();
            started = true;
        }
        return true;
    }

    /** Se cayo la conexion de este jugador: se le guarda el puesto un rato. */
    public void markDisconnected(String role, long now) {
        Player player = players.get(role);
        if (player != null) {
            player.markDisconnected(now);
        }
    }

    /**
     * Vuelve a su puesto quien presenta el token con el que entro. Devuelve null si
     * pudo, o el motivo si no.
     */
    public synchronized String rejoin(String role, String token) {
        Player player = role == null ? null : players.get(role);
        String expected = role == null ? null : seatTokens.get(role);
        if (player == null || expected == null) {
            return "seat_expired";
        }
        if (!expected.equals(token)) {
            return "bad_token";
        }
        player.markConnected();
        return null;
    }

    /** Roles cuyo puesto vencio (desconectados hace mas de RECONNECT_GRACE_MS). */
    public java.util.List<String> expiredSeats(long now) {
        return players.values().stream()
                .filter(p -> !p.isConnected() && now - p.getDisconnectedAt() >= RECONNECT_GRACE_MS)
                .map(Player::getPlayerId)
                .toList();
    }

    public boolean isStarted() {
        return started;
    }

    public LobbyState lobbyState() {
        return new LobbyState(started, host, building);
    }

    public PickupResult attemptPickup(String playerId, String itemId, double x, double y) {
        Player player = players.get(playerId);
        if (player == null) {
            return PickupResult.rejected("unknown_player");
        }

        WorldItem item = worldItems.get(itemId);
        if (item == null) {
            return PickupResult.rejected("unknown_item");
        }
        if (item.floor() != player.getFloor()) {
            return PickupResult.rejected("too_far");
        }

        String claimedBy = claimedItems.putIfAbsent(itemId, playerId);
        if (claimedBy != null) {
            return PickupResult.rejected("already_claimed");
        }

        double dx = player.getX() - item.x();
        double dy = player.getY() - item.y();
        if (Math.sqrt(dx * dx + dy * dy) > PICKUP_RANGE_PX) {
            claimedItems.remove(itemId, playerId);
            return PickupResult.rejected("too_far");
        }

        boolean added = player.tryAddItem(new InventorySlot(item.type(), item.itemId(), item.itemName()));
        if (!added) {
            claimedItems.remove(itemId, playerId);
            return PickupResult.rejected("inventory_full");
        }

        return PickupResult.ok();
    }

    public List<PlayerState> playerStates() {
        long now = System.currentTimeMillis();
        return players.values().stream()
                .map(p -> {
                    long reloadingMs = p.reloadingInMs(now);
                    Weapon weapon = p.getEquipped();
                    return new PlayerState(p.getPlayerId(), p.getRole(), p.getHealth(), p.getGaravitos(),
                            p.inventorySnapshot(), p.getFloor(), Math.round(p.getX()), Math.round(p.getY()),
                            p.getLifeState(), p.isInvulnerable(), p.chargedReadyInMs(now),
                            weapon, p.magazine(weapon), p.getReserveAmmo(), reloadingMs,
                            p.getShotSeq(), p.getShotFacing(),
                            p.getReviveTargetId(), p.reviveProgress(now),
                            missionBoard.viewFor(p.getPlayerId()), p.abilityReadyInMs(now), p.isConnected(),
                            p.getName(), p.getHidingIn(), p.hiddenMs(now), p.getCandies(), p.getCostume(), false);
                })
                .toList();
    }

    /**
     * Posicion que reporta el cliente. Devuelve false si se rechazo (movimiento
     * imposible): el jugador queda donde el servidor lo tenia.
     */
    public boolean reportPosition(String playerId, int floor, double x, double y) {
        Player player = players.get(playerId);
        // Un caido se queda donde cayo (su cliente pasa a modo espectador) y uno escondido
        // no se mueve del armario.
        if (player == null || !player.isAlive() || player.isHidden() || !building.hasFloor(floor)) {
            return true;
        }
        long now = System.currentTimeMillis();
        if (!isValidMove(player, floor, x, y, now)) {
            player.countRejectedMove();
            return false;
        }
        if (floor == player.getFloor() && player.getLastMoveAt() > 0) {
            double seconds = Math.max(0.05, (now - player.getLastMoveAt()) / 1000.0);
            if (Math.hypot(x - player.getX(), y - player.getY()) / seconds > NOISY_SPEED_PX_S) {
                player.makeNoise(now + NOISE_RUN_MS);
            }
        }
        player.reportPosition(floor, x, y);
        player.setLastMoveAt(now);
        return true;
    }

    /** True (como mucho cada CORRECTION_EVERY_MS) si hay que mandarle a este jugador su posicion real. */
    public boolean shouldCorrect(String playerId) {
        Player player = players.get(playerId);
        return player != null && player.shouldSendCorrection(System.currentTimeMillis(), CORRECTION_EVERY_MS);
    }

    boolean isValidMove(Player player, int floor, double x, double y, long now) {
        if (floor == player.getFloor()) {
            // El cliente reporta cada ~100 ms mientras se mueve: entre dos reportes nunca
            // deberia haber mas de medio segundo de camino, aunque haya estado quieto antes.
            double elapsed = player.getLastMoveAt() == 0 ? MOVE_MAX_GAP_S
                    : Math.min(MOVE_MAX_GAP_S, Math.max(0, (now - player.getLastMoveAt()) / 1000.0));
            double distance = Math.hypot(x - player.getX(), y - player.getY());
            if (distance > MOVE_SLACK_PX + MOVE_MAX_SPEED_PX_S * elapsed) {
                return false;
            }
            FloorGrid grid = floorGrid(floor);
            if (!grid.isWalkable(x, y + FOOT_OFFSET_PX) && !grid.isWalkable(x, y)) {
                return false;
            }
            return distance < FloorGrid.TILE * 0.75
                    || grid.hasLineOfSight(player.getX(), player.getY() + FOOT_OFFSET_PX, x, y + FOOT_OFFSET_PX)
                    || grid.hasLineOfSight(player.getX(), player.getY(), x, y);
        }
        if (Math.abs(floor - player.getFloor()) != 1) {
            return false;
        }
        boolean goingUp = floor > player.getFloor();
        FloorGrid.StairsSpec from = floorGrid(player.getFloor()).stairs(goingUp ? "up" : "down");
        FloorGrid.StairsSpec to = floorGrid(floor).stairs(goingUp ? "down" : "up");
        return from != null && to != null
                && (from.contains(player.getX(), player.getY(), STAIRS_MARGIN_PX)
                        || from.contains(player.getX(), player.getY() + FOOT_OFFSET_PX, STAIRS_MARGIN_PX))
                && Math.hypot(x - to.arrivalX(), y - to.arrivalY()) <= STAIRS_ARRIVAL_RADIUS_PX;
    }

    private void collectAcid(Zombie zombie) {
        AcidProjectile acid = zombie.consumeAcid();
        if (acid != null) {
            acids.put(acid.getId(), acid);
        }
    }

    /**
     * Entra al armario libre mas cercano, o sale si ya estaba escondido. Rechazos:
     * downed, no_spot (no hay uno al alcance), spot_taken, on_cooldown.
     */
    public synchronized PlayerActionResult attemptHide(String playerId, long now) {
        Player player = players.get(playerId);
        if (player == null || !player.isAlive()) {
            return PlayerActionResult.rejected("downed");
        }
        if (player.isHidden()) {
            player.unhide(now, HIDE_COOLDOWN_MS);
            return PlayerActionResult.ok();
        }
        if (!player.canHide(now)) {
            return PlayerActionResult.rejected("on_cooldown");
        }
        HideSpots.Spot spot = HideSpots.near(building, player.getFloor(), player.getX(), player.getY());
        if (spot == null) {
            return PlayerActionResult.rejected("no_spot");
        }
        boolean taken = players.values().stream().anyMatch(other -> spot.id().equals(other.getHidingIn()));
        if (taken) {
            return PlayerActionResult.rejected("spot_taken");
        }
        player.hide(spot.id(), now, HIDE_MAX_MS);
        return PlayerActionResult.ok();
    }

    private boolean blindHears(Zombie zombie, Player player, long now) {
        if (player.getFloor() != zombie.getFloor()) {
            return false;
        }
        double distance = Math.hypot(player.getX() - zombie.getX(), player.getY() - zombie.getY());
        return distance <= BLIND_TOUCH_PX || (player.isNoisy(now) && distance <= BLIND_HEAR_PX);
    }

    // Grito: todos los zombis del piso a su alcance se enfurecen un rato.
    private void resolveScreams(long now) {
        zombies.values().stream().filter(Zombie::consumeScream).toList().forEach(screamer ->
                zombies.values().stream()
                        .filter(other -> other.isAlive() && other.getFloor() == screamer.getFloor()
                                && Math.hypot(other.getX() - screamer.getX(), other.getY() - screamer.getY()) <= SCREAM_REACH_PX)
                        .forEach(other -> other.enrage(now + ENRAGE_MS)));
    }

    /**
     * Explosiones: daña a los jugadores y a los zombis cercanos. Un explosivo que muere
     * por otra explosion revienta tambien (cadena), por eso se repite hasta que no quede
     * ninguna pendiente. Los zombis que mata una explosion cuentan para la cuota.
     */
    private void resolveBlasts(long now) {
        for (int round = 0; round < 6; round++) {
            List<Zombie> exploding = zombies.values().stream().filter(z -> z.pendingBlastDamage() > 0).toList();
            if (exploding.isEmpty()) {
                return;
            }
            for (Zombie bomb : exploding) {
                int damage = bomb.consumeBlast();
                String id = "bl" + (++blastSequence);
                blasts.put(id, new BlastState(id, bomb.getFloor(), Math.round(bomb.getX()), Math.round(bomb.getY()), now));
                players.values().forEach(player -> {
                    if (player.isAlive() && player.getFloor() == bomb.getFloor()
                            && Math.hypot(player.getX() - bomb.getX(), player.getY() - bomb.getY()) <= BLAST_RADIUS_PX) {
                        player.takeDamage(damage);
                    }
                });
                int killed = 0;
                for (Zombie other : zombies.values()) {
                    if (other != bomb && other.isAlive() && other.getFloor() == bomb.getFloor()
                            && Math.hypot(other.getX() - bomb.getX(), other.getY() - bomb.getY()) <= BLAST_RADIUS_PX) {
                        double angle = Math.atan2(other.getY() - bomb.getY(), other.getX() - bomb.getX());
                        if (other.hit(BLAST_ZOMBIE_DAMAGE, Math.cos(angle) * 300, Math.sin(angle) * 300, now)) {
                            killed++;
                        }
                    }
                }
                if (killed > 0) {
                    waveDirector.onZombiesKilled(killed);
                }
            }
        }
    }

    public List<BlastState> blastStates() {
        return List.copyOf(blasts.values());
    }

    public List<PuddleState> puddleStates() {
        long now = System.currentTimeMillis();
        return puddles.values().stream().map(puddle -> puddle.toState(now)).toList();
    }

    /** Algunos zombis sueltan dulces: 1 de cada 3 da uno (a veces dos); el jefe, diez. */
    static int candiesFor(int zombieKills, int bossKills, java.util.random.RandomGenerator random) {
        int candies = bossKills * CANDIES_PER_BOSS;
        for (int i = 0; i < zombieKills; i++) {
            double roll = random.nextDouble();
            if (roll < CANDY_CHANCE) {
                candies += roll < CANDY_CHANCE / 6 ? 2 : 1;
            }
        }
        return candies;
    }

    /** Disfraz del jugador (se llama al unirse o al volver a su puesto). */
    public synchronized void setPlayerCostume(String role, String costume) {
        Player player = players.get(role);
        if (player != null) {
            player.setCostume(costume);
        }
    }

    /** Apodo del jugador (se llama al unirse o al volver a su puesto). */
    public synchronized void setPlayerName(String role, String name) {
        Player player = players.get(role);
        if (player != null && name != null) {
            player.setName(name);
        }
    }

    /**
     * Aviso al equipo ("¡zombis aqui!", "necesito ayuda"...). Va con la posicion que el
     * servidor tiene del jugador. Devuelve null si el tipo no existe o si mando uno hace
     * muy poco.
     */
    public LastEvent attemptPing(String playerId, String kind, long now) {
        Player player = players.get(playerId);
        if (player == null || kind == null || !PING_KINDS.contains(kind) || !player.tryPing(now, PING_COOLDOWN_MS)) {
            return null;
        }
        return LastEvent.ping(playerId, kind, player.getFloor(), Math.round(player.getX()), Math.round(player.getY()));
    }

    public List<ProjectileState> projectileStates() {
        return acids.values().stream().map(AcidProjectile::toState).toList();
    }

    public List<ZombieState> zombieStates() {
        return zombies.values().stream().map(Zombie::toState).toList();
    }

    public boolean consumeWipedRun() {
        boolean value = wipedRun;
        wipedRun = false;
        return value;
    }

    /** True (una sola vez) si el equipo acaba de ganar el ultimo Kinder. */
    public boolean consumeVictory() {
        boolean value = victoryPending;
        victoryPending = false;
        return value;
    }

    public WaveState waveState() {
        int[] progress = missionBoard.teamProgress(players.values());
        return waveDirector.state(System.currentTimeMillis()).withMissions(progress[0], progress[1]);
    }

    /** Reparte las misiones del Kinder que viene (al empezar su respiro) y a quien llegue tarde. */
    private void dealMissions() {
        int upcoming = waveDirector.upcomingKinder();
        if (upcoming > 0 && upcoming != missionBoard.getKinder()) {
            missionBoard.deal(upcoming, players.values());
        }
        players.values().forEach(missionBoard::ensureDealt);
    }

    private int aliveZombieCount() {
        return (int) zombies.values().stream().filter(Zombie::isAlive).count();
    }

    public void tick(long now, double deltaSeconds) {
        if (!started) {
            return;
        }
        dealMissions();
        waveDirector.update(now, aliveZombieCount(), players.values(), missionBoard.allDone(players.values()))
                .forEach(spawned -> zombies.put(spawned.getId(), spawned));
        if (waveDirector.consumeBossDue()) {
            spawnBoss(now);
        }
        if (waveDirector.consumeJustCleared()) {
            // Cuota cumplida (o jefe vencido): la horda que quedaba se retira.
            zombies.clear();
            acids.clear();
            puddles.clear();
            boss = null;
            if (waveDirector.isVictory()) {
                victoryPending = true;
                closeRun(true, WaveCurve.KINDER_COUNT, now);
            }
        }

        players.values().forEach(player -> player.expireHide(now, HIDE_COOLDOWN_MS));
        List<Player> alive = players.values().stream().filter(Player::isAlive).toList();
        // Los escondidos estan vivos pero los zombis no los ven.
        List<Player> targets = alive.stream().filter(player -> !player.isHidden()).toList();

        if (alive.isEmpty() && !players.isEmpty()) {
            closeRun(false, waveDirector.getKinder(), now);
            zombies.clear();
            acids.clear();
            puddles.clear();
            boss = null;
            waveDirector.resetRun(now, WaveCurve.WAVE_REST_MS);
            players.values().forEach(player -> player.revive(REVIVE_HEALTH));
            wipedRun = true;
            return;
        }

        List<Zombie> living = zombies.values().stream().filter(Zombie::isAlive).toList();

        Map<String, int[][]> fields = new java.util.HashMap<>();
        targets.forEach(target ->
                fields.put(target.getPlayerId(),
                        floorGrid(target.getFloor()).distanceField(target.getX(), target.getY())));

        for (Zombie zombie : living) {
            Player target = nearestPlayer(zombie, zombie.getKind() == ZombieKind.BLIND
                    ? targets.stream().filter(player -> blindHears(zombie, player, now)).toList()
                    : targets);
            if (target == null) {
                // Sin nadie en su piso igual termina la mordida o el aturdimiento en curso.
                zombie.updateAttack(null, now);
                collectAcid(zombie);
                continue;
            }
            double[] separation = separationFor(zombie, living);
            zombie.step(floorGrid(zombie.getFloor()), fields.get(target.getPlayerId()), target.getX(), target.getY(),
                    separation[0], separation[1], deltaSeconds, now);
            zombie.updateAttack(target, floorGrid(zombie.getFloor()), now);
            collectAcid(zombie);
        }
        acids.values().removeIf(acid -> !acid.step(floorGrid(acid.getFloor()), players.values(), deltaSeconds, now));

        resolveScreams(now);
        resolveBlasts(now);
        blasts.values().removeIf(blast -> now - blast.bornAt() > BLAST_VISIBLE_MS);

        // El escupidor muerto deja un charco de acido donde cayo.
        zombies.values().stream()
                .filter(zombie -> !zombie.isAlive() && zombie.getKind() == ZombieKind.SPITTER)
                .forEach(zombie -> {
                    String id = "pz" + (++puddleSequence);
                    puddles.put(id, new AcidPuddle(id, zombie.getFloor(), zombie.getX(), zombie.getY(), now));
                });
        puddles.values().removeIf(puddle -> !puddle.step(players.values(), now));
        zombies.values().removeIf(zombie -> !zombie.isAlive());
        updateBoss(now, deltaSeconds, targets);
        updateRevives(now);
        updateBarricades(deltaSeconds);
        updateKinderEvent(now);

        if (waveDirector.restingSeconds(now) > 0) {
            players.values().forEach(player -> {
                if (!player.isAlive()) {
                    player.revive(REVIVE_HEALTH);
                }
            });
        }
    }

    /**
     * Termina la corrida: arma el resumen (pantalla de resultados y ranking) y pone en
     * cero las estadisticas para la siguiente.
     */
    private void closeRun(boolean victory, int kinderReached, long now) {
        List<MatchSummary.PlayerSummary> stats = players.values().stream()
                .map(Player::statsSnapshot)
                .sorted(java.util.Comparator.comparing(MatchSummary.PlayerSummary::role))
                .toList();
        MatchSummary summary = new MatchSummary(++summarySequence, building, victory, kinderReached,
                Math.max(0, (now - runStartedAt) / 1000), stats);
        lastSummary = summary;
        summariesToSave.add(summary);
        players.values().forEach(Player::resetStats);
        runStartedAt = now;
    }

    /** El resumen de la ultima corrida terminada, o null si todavia no termino ninguna. */
    public MatchSummary lastSummary() {
        return lastSummary;
    }

    /** Siguiente resumen que todavia no se guardo en el historial, o null. */
    public MatchSummary pollSummaryToSave() {
        return summariesToSave.poll();
    }

    /** Programa, vence o limpia el evento del Kinder. */
    private void updateKinderEvent(long now) {
        int kinder = waveDirector.getKinder();
        if (!waveDirector.isActive()) {
            // Termino el Kinder (o cayo el equipo): el evento que quedaba se cancela.
            if (activeEvent != null) {
                activeEvent = null;
            }
            nextEventAt = 0;
            return;
        }
        ActiveEvent current = activeEvent;
        if (current != null) {
            if (now >= current.endsAt()) {
                activeEvent = null;
                if (current.type() == KinderEvent.Type.SUPPLY) {
                    waveDirector.surge(players.values(), SUPPLY_FAIL_SURGE).forEach(z -> zombies.put(z.getId(), z));
                    pendingEvents.add(new LastEvent("EVENT_FAILED", null, current.id(), current.type().name()));
                } else {
                    pendingEvents.add(new LastEvent("EVENT_RESOLVED", null, current.id(), current.type().name()));
                }
            }
            return;
        }
        if (kinder < FIRST_EVENT_KINDER || eventKinder == kinder) {
            return;
        }
        java.util.concurrent.ThreadLocalRandom random = java.util.concurrent.ThreadLocalRandom.current();
        if (nextEventAt == 0) {
            nextEventAt = now + random.nextLong(EVENT_MIN_DELAY_MS, EVENT_MAX_DELAY_MS);
            return;
        }
        if (now < nextEventAt) {
            return;
        }
        // Kinder par: apagon; impar: suministros. Asi en una corrida aparecen los dos.
        KinderEvent.Type type = kinder % 2 == 0 ? KinderEvent.Type.BLACKOUT : KinderEvent.Type.SUPPLY;
        startKinderEvent(type, now, random);
    }

    private void startKinderEvent(KinderEvent.Type type, long now, java.util.random.RandomGenerator random) {
        List<MissionSite> sites = MissionCatalog.sitesFor(building);
        MissionSite site = sites.get(random.nextInt(sites.size()));
        long duration = type == KinderEvent.Type.BLACKOUT ? BLACKOUT_MS : SUPPLY_MS;
        activeEvent = new ActiveEvent("ev" + (++eventSequence), type, site, now + duration);
        eventKinder = waveDirector.getKinder();
        nextEventAt = 0;
        pendingEvents.add(new LastEvent("EVENT_STARTED", null, activeEvent.id(), type.name()));
    }

    /** Para pruebas y para forzar un evento en el Kinder actual. */
    void forceKinderEvent(KinderEvent.Type type, long now) {
        startKinderEvent(type, now, java.util.random.RandomGenerator.getDefault());
    }

    public KinderEvent kinderEvent() {
        ActiveEvent current = activeEvent;
        if (current == null) {
            return null;
        }
        MissionSite site = current.site();
        return new KinderEvent(current.id(), current.type(), site.room(), site.floor(),
                Math.round(site.x()), Math.round(site.y()), Math.max(0, current.endsAt() - System.currentTimeMillis()));
    }

    /**
     * Un jugador interactua con el evento (tablero electrico o caja). El apagon lo
     * arregla Infraestructura (o cualquiera si nadie tiene ese rol vivo); los
     * suministros los recoge cualquiera y le sirven a todo el equipo.
     */
    public synchronized PlayerActionResult attemptEventInteract(String playerId) {
        Player player = players.get(playerId);
        ActiveEvent current = activeEvent;
        if (player == null || current == null) {
            return PlayerActionResult.rejected("no_event");
        }
        if (!player.isAlive()) {
            return PlayerActionResult.rejected("downed");
        }
        MissionSite site = current.site();
        if (player.getFloor() != site.floor()
                || Math.hypot(player.getX() - site.x(), player.getY() - site.y()) > EVENT_RANGE_PX) {
            return PlayerActionResult.rejected("too_far");
        }
        if (current.type() == KinderEvent.Type.BLACKOUT) {
            boolean builderAround = players.values().stream()
                    .anyMatch(p -> p.isAlive() && BUILDER_ROLE.equals(p.getRole()));
            if (builderAround && !BUILDER_ROLE.equals(player.getRole())) {
                return PlayerActionResult.rejected("needs_builder");
            }
        } else {
            players.values().stream().filter(Player::isAlive).forEach(p -> {
                p.addEarnings(SUPPLY_GARAVITOS);
                p.heal(SUPPLY_HEAL);
            });
        }
        activeEvent = null;
        pendingEvents.add(new LastEvent("EVENT_RESOLVED", playerId, current.id(), current.type().name()));
        return PlayerActionResult.ok();
    }

    /** Los zombis pegados a una barricada la van rompiendo. */
    private void updateBarricades(double deltaSeconds) {
        for (Barricade barricade : barricades.values()) {
            long touching = zombies.values().stream()
                    .filter(z -> z.isAlive() && z.getFloor() == barricade.getFloor()
                            && Math.hypot(z.getX() - barricade.centerX(), z.getY() - barricade.centerY()) <= BARRICADE_CONTACT_PX)
                    .count();
            double damage = touching * Barricade.ZOMBIE_DPS * deltaSeconds;
            BossZombie current = boss;
            if (current != null && current.isAlive() && current.getFloor() == barricade.getFloor()
                    && Math.hypot(current.getX() - barricade.centerX(), current.getY() - barricade.centerY()) <= BOSS_BARRICADE_CONTACT_PX) {
                damage += Barricade.BOSS_DPS * deltaSeconds;
            }
            if (damage > 0 && barricade.damage(damage)) {
                removeBarricade(barricade);
            }
        }
    }

    private void removeBarricade(Barricade barricade) {
        if (barricades.remove(barricade.getId()) != null) {
            floorGrid(barricade.getFloor()).setBlocked(barricade.getCol(), barricade.getRow(), false);
        }
    }

    public List<BarricadeState> barricadeStates() {
        return barricades.values().stream().map(Barricade::toState).toList();
    }

    /**
     * Infraestructura pone una barricada en la celda que tiene enfrente. Tiene que
     * estar libre (sin pared, puerta, otra barricada ni jugador) y respeta el
     * enfriamiento y el maximo de barricadas activas.
     */
    public synchronized PlayerActionResult attemptPlaceBarricade(String playerId, double x, double y, double facing) {
        Player player = players.get(playerId);
        if (player == null) {
            return PlayerActionResult.rejected("unknown_player");
        }
        if (!BUILDER_ROLE.equals(player.getRole())) {
            return PlayerActionResult.rejected("wrong_role");
        }
        if (!player.isAlive()) {
            return PlayerActionResult.rejected("downed");
        }
        long mine = barricades.values().stream().filter(b -> b.getOwnerId().equals(playerId)).count();
        if (mine >= MAX_BARRICADES) {
            return PlayerActionResult.rejected("too_many_barricades");
        }
        FloorGrid grid = floorGrid(player.getFloor());
        int[] cell = FloorGrid.cellOf(x + Math.cos(facing) * FloorGrid.TILE, y + Math.sin(facing) * FloorGrid.TILE);
        double cx = cell[0] * FloorGrid.TILE + FloorGrid.TILE / 2.0;
        double cy = cell[1] * FloorGrid.TILE + FloorGrid.TILE / 2.0;
        boolean occupied = players.values().stream().anyMatch(p -> p.getFloor() == player.getFloor()
                && Math.hypot(p.getX() - cx, p.getY() - cy) < FloorGrid.TILE * 0.75);
        if (!grid.isWalkable(cx, cy) || occupied) {
            return PlayerActionResult.rejected("blocked_spot");
        }
        if (!player.tryConsumeAbility(System.currentTimeMillis(), BARRICADE_COOLDOWN_MS)) {
            return PlayerActionResult.rejected("on_cooldown");
        }
        Barricade barricade = new Barricade("b" + (++barricadeSequence), playerId, player.getFloor(), cell[0], cell[1]);
        barricades.put(barricade.getId(), barricade);
        grid.setBlocked(cell[0], cell[1], true);
        return PlayerActionResult.ok();
    }

    public PlayerActionResult attemptRepairBarricade(String playerId, String barricadeId) {
        Player player = players.get(playerId);
        Barricade barricade = barricadeId == null ? null : barricades.get(barricadeId);
        if (player == null || barricade == null) {
            return PlayerActionResult.rejected("unknown_barricade");
        }
        if (!BUILDER_ROLE.equals(player.getRole())) {
            return PlayerActionResult.rejected("wrong_role");
        }
        if (!player.isAlive()) {
            return PlayerActionResult.rejected("downed");
        }
        if (player.getFloor() != barricade.getFloor()
                || Math.hypot(player.getX() - barricade.centerX(), player.getY() - barricade.centerY()) > BARRICADE_REPAIR_RANGE_PX) {
            return PlayerActionResult.rejected("too_far");
        }
        barricade.repair(Barricade.REPAIR_AMOUNT);
        return PlayerActionResult.ok();
    }

    /** Economia le pasa Garavitos a un compañero (desde cualquier lugar del edificio). */
    public PlayerActionResult attemptTransfer(String playerId, String targetId, int amount) {
        Player giver = players.get(playerId);
        Player receiver = targetId == null ? null : players.get(targetId);
        if (giver == null || receiver == null || giver == receiver) {
            return PlayerActionResult.rejected("unknown_player");
        }
        if (!TREASURER_ROLE.equals(giver.getRole())) {
            return PlayerActionResult.rejected("wrong_role");
        }
        if (!giver.tryTakeGaravitos(amount)) {
            return PlayerActionResult.rejected("insufficient_garavitos");
        }
        receiver.addGaravitos(amount);
        return PlayerActionResult.ok();
    }

    /** Precio que paga este jugador (Economia tiene descuento). */
    static int priceFor(Player player, int price) {
        return TREASURER_ROLE.equals(player.getRole()) ? (int) Math.ceil(price * (1 - TREASURER_DISCOUNT)) : price;
    }

    /** Termina (o corta) las reanimaciones en curso. */
    private void updateRevives(long now) {
        for (Player reviver : players.values()) {
            String targetId = reviver.getReviveTargetId();
            if (targetId == null) {
                continue;
            }
            Player target = players.get(targetId);
            boolean broken = target == null
                    || target.isAlive()
                    || !reviver.isAlive()
                    || target.getFloor() != reviver.getFloor()
                    || Math.hypot(target.getX() - reviver.getX(), target.getY() - reviver.getY()) > REVIVE_BREAK_PX
                    || reviver.getLastDamagedAt() > reviver.getReviveStartedAt();
            if (broken) {
                reviver.stopRevive();
            } else if (now >= reviver.getReviveUntil()) {
                target.revive(FIELD_REVIVE_HEALTH);
                reviver.stopRevive();
                reviver.recordRevive();
                pendingEvents.add(LastEvent.revived(target.getPlayerId(), reviver.getPlayerId()));
            }
        }
    }

    /** Biomedica empieza a revivir a un compañero caido que tiene al lado. */
    public PlayerActionResult attemptReviveStart(String reviverId, String targetId) {
        Player reviver = players.get(reviverId);
        Player target = targetId == null ? null : players.get(targetId);
        if (reviver == null || target == null) {
            return PlayerActionResult.rejected("unknown_player");
        }
        if (!REVIVER_ROLE.equals(reviver.getRole())) {
            return PlayerActionResult.rejected("wrong_role");
        }
        if (!reviver.isAlive()) {
            return PlayerActionResult.rejected("downed");
        }
        if (target.isAlive()) {
            return PlayerActionResult.rejected("not_downed");
        }
        if (target.getFloor() != reviver.getFloor()
                || Math.hypot(target.getX() - reviver.getX(), target.getY() - reviver.getY()) > REVIVE_RANGE_PX) {
            return PlayerActionResult.rejected("too_far");
        }
        if (!targetId.equals(reviver.getReviveTargetId())) {
            reviver.startRevive(targetId, System.currentTimeMillis(), REVIVE_MS);
        }
        return PlayerActionResult.ok();
    }

    public void attemptReviveCancel(String reviverId) {
        Player reviver = players.get(reviverId);
        if (reviver != null) {
            reviver.stopRevive();
        }
    }

    /** Siguiente aviso pendiente del tick (p. ej. alguien fue revivido), o null. */
    public LastEvent pollEvent() {
        return pendingEvents.poll();
    }

    /** El jefe aparece en el piso con mas jugadores vivos, lejos de ellos. */
    private void spawnBoss(long now) {
        int floor = busiestFloor();
        List<Player> onFloor = players.values().stream()
                .filter(p -> p.isAlive() && p.getFloor() == floor).toList();
        FloorGrid.SpawnPoint point = WaveDirector.pickSpawnPoint(floorGrid(floor).spawnPoints(), onFloor,
                java.util.concurrent.ThreadLocalRandom.current());
        boss = new BossZombie("boss" + (++bossSequence), floor, point.x(), point.y(), bossConfig,
                java.util.random.RandomGenerator.getDefault());
        bossAloneSince = 0;
    }

    private int busiestFloor() {
        int best = building.floorCount();
        long bestCount = -1;
        for (int floor = building.floorCount(); floor >= 1; floor--) {
            final int current = floor;
            long count = players.values().stream().filter(p -> p.isAlive() && p.getFloor() == current).count();
            if (count > bestCount) {
                bestCount = count;
                best = floor;
            }
        }
        return best;
    }

    private void updateBoss(long now, double deltaSeconds, List<Player> targets) {
        BossZombie current = boss;
        if (current == null || !current.isAlive()) {
            return;
        }
        List<Player> onFloor = targets.stream().filter(p -> p.getFloor() == current.getFloor()).toList();
        if (onFloor.isEmpty() && !targets.isEmpty()) {
            if (bossAloneSince == 0) {
                bossAloneSince = now;
            } else if (now - bossAloneSince >= BOSS_RELOCATE_MS) {
                // Nadie en su piso: va a buscarlos, para que la corrida no se trabe con el
                // equipo escondido en otro piso.
                int floor = busiestFloor();
                List<Player> there = targets.stream().filter(p -> p.getFloor() == floor).toList();
                FloorGrid.SpawnPoint point = WaveDirector.pickSpawnPoint(floorGrid(floor).spawnPoints(), there,
                        java.util.concurrent.ThreadLocalRandom.current());
                current.relocate(floor, point.x(), point.y(), now);
                bossAloneSince = 0;
                return;
            }
        } else {
            bossAloneSince = 0;
        }
        current.update(now, deltaSeconds, floorGrid(current.getFloor()), onFloor);
    }

    public BossView bossView() {
        BossZombie current = boss;
        return current == null || !current.isAlive() ? null : current.toView();
    }

    private FloorGrid floorGrid(int floor) {
        return floors.get(floor - 1);
    }

    private Player nearestPlayer(Zombie zombie, List<Player> candidates) {
        Player nearest = null;
        double best = Double.MAX_VALUE;
        for (Player candidate : candidates) {
            if (candidate.getFloor() != zombie.getFloor()) {
                continue;
            }
            double distance = Math.hypot(candidate.getX() - zombie.getX(), candidate.getY() - zombie.getY());
            if (distance < best) {
                best = distance;
                nearest = candidate;
            }
        }
        return nearest;
    }

    private double[] separationFor(Zombie zombie, List<Zombie> others) {
        double sx = 0;
        double sy = 0;
        for (Zombie other : others) {
            if (other == zombie || other.getFloor() != zombie.getFloor()) {
                continue;
            }
            double dx = zombie.getX() - other.getX();
            double dy = zombie.getY() - other.getY();
            double distanceSq = dx * dx + dy * dy;
            if (distanceSq == 0 || distanceSq > SEPARATION_RADIUS_PX * SEPARATION_RADIUS_PX) {
                continue;
            }
            double distance = Math.sqrt(distanceSq);
            sx += (dx / distance) * SEPARATION_FORCE;
            sy += (dy / distance) * SEPARATION_FORCE;
        }
        return new double[] { sx, sy };
    }

    public AttackResult attemptAttack(String playerId, AttackType type, double x, double y, double facing) {
        Player player = players.get(playerId);
        if (player == null) {
            return AttackResult.rejected("unknown_player");
        }
        if (!player.isAlive()) {
            return AttackResult.rejected("downed");
        }
        if (player.isHidden()) {
            return AttackResult.rejected("hidden");
        }

        long now = System.currentTimeMillis();
        // El origen del golpe es la posicion del servidor, salvo una diferencia chica
        // (el ataque puede llegar antes que el ultimo reporte de movimiento).
        player.makeNoise(now + NOISE_ATTACK_MS);
        if (Math.hypot(x - player.getX(), y - player.getY()) > ACTION_POSITION_TOLERANCE_PX) {
            x = player.getX();
            y = player.getY();
        }

        if (type == AttackType.CHARGED) {
            if (!player.tryConsumeChargedCooldown(now, CHARGED_COOLDOWN_MS)) {
                return AttackResult.rejected("on_cooldown");
            }
            return strikeArea(player, x, y, now);
        }

        Weapon weapon = player.getEquipped();
        if (!player.tryConsumeAttackCooldown(now, weapon.cooldownMs())) {
            return AttackResult.rejected("on_cooldown");
        }
        if (!weapon.ranged()) {
            return strikeMelee(player, weapon, x, y, facing, now);
        }
        String misfire = player.tryFire(now, facing);
        if (misfire != null) {
            return AttackResult.rejected(misfire);
        }
        return shoot(player, weapon, x, y, facing, now);
    }

    /** Golpe cuerpo a cuerpo (puños o hacha): todos los zombis en el arco frente al jugador. */
    private AttackResult strikeMelee(Player player, Weapon weapon, double x, double y, double facing, long now) {
        int hits = 0;
        int kills = 0;
        int bossKills = 0;
        for (Zombie zombie : zombies.values()) {
            if (!zombie.isAlive() || zombie.getFloor() != player.getFloor()) {
                continue;
            }
            double dx = zombie.getX() - x;
            double dy = zombie.getY() - y;
            double angle = Math.atan2(dy, dx);
            if (Math.hypot(dx, dy) > weapon.range() || Math.abs(wrapAngle(angle - facing)) > ATTACK_HALF_ARC_RAD) {
                continue;
            }
            hits++;
            if (zombie.hit(weapon.damage(), Math.cos(angle) * weapon.knockback(), Math.sin(angle) * weapon.knockback(), now)) {
                kills++;
            }
        }
        BossZombie target = boss;
        if (target != null && target.isAlive() && target.getFloor() == player.getFloor()) {
            double dx = target.getX() - x;
            double dy = target.getY() - y;
            boolean inRange = Math.hypot(dx, dy) <= weapon.range() + BOSS_HIT_BONUS_PX;
            if (inRange && Math.abs(wrapAngle(Math.atan2(dy, dx) - facing)) <= ATTACK_HALF_ARC_RAD) {
                hits++;
                bossKills += hitBoss(player, target, weapon.damage(), false, now);
            }
        }
        return payKills(player, hits, kills, bossKills);
    }

    /** Ataque cargado: pega a todo lo que este alrededor, sin importar hacia donde mira. */
    private AttackResult strikeArea(Player player, double x, double y, long now) {
        int hits = 0;
        int kills = 0;
        int bossKills = 0;
        for (Zombie zombie : zombies.values()) {
            if (!zombie.isAlive() || zombie.getFloor() != player.getFloor()) {
                continue;
            }
            double dx = zombie.getX() - x;
            double dy = zombie.getY() - y;
            if (Math.hypot(dx, dy) > CHARGED_RANGE_PX) {
                continue;
            }
            hits++;
            double angle = Math.atan2(dy, dx);
            if (zombie.hit(CHARGED_DAMAGE, Math.cos(angle) * CHARGED_KNOCKBACK, Math.sin(angle) * CHARGED_KNOCKBACK, now)) {
                kills++;
            }
        }
        BossZombie target = boss;
        if (target != null && target.isAlive() && target.getFloor() == player.getFloor()
                && Math.hypot(target.getX() - x, target.getY() - y) <= CHARGED_RANGE_PX + BOSS_HIT_BONUS_PX) {
            hits++;
            bossKills += hitBoss(player, target, CHARGED_DAMAGE, true, now);
        }
        return payKills(player, hits, kills, bossKills);
    }

    /**
     * Disparo: un rayo desde el jugador hacia {@code facing} que se corta en la primera
     * pared o puerta cerrada. Alcanza a los zombis mas cercanos sobre la linea, hasta
     * los que el arma puede atravesar.
     */
    private AttackResult shoot(Player player, Weapon weapon, double x, double y, double facing, long now) {
        FloorGrid grid = floorGrid(player.getFloor());
        double dirX = Math.cos(facing);
        double dirY = Math.sin(facing);
        double reach = 0;
        while (reach < weapon.range() && grid.isOpenForShots(x + dirX * (reach + BULLET_STEP_PX), y + dirY * (reach + BULLET_STEP_PX))) {
            reach += BULLET_STEP_PX;
        }
        final double maxReach = reach;

        record Target(Zombie zombie, double along) {
        }
        List<Target> inLine = new java.util.ArrayList<>();
        for (Zombie zombie : zombies.values()) {
            if (!zombie.isAlive() || zombie.getFloor() != player.getFloor()) {
                continue;
            }
            double along = alongRay(zombie.getX() - x, zombie.getY() - y, dirX, dirY,
                    zombie.isTough() ? TOUGH_BULLET_HIT_RADIUS_PX : BULLET_HIT_RADIUS_PX, maxReach);
            if (along >= 0) {
                inLine.add(new Target(zombie, along));
            }
        }
        inLine.sort(java.util.Comparator.comparingDouble(Target::along));

        int hits = 0;
        int kills = 0;
        int bossKills = 0;
        double knockback = weapon.knockback();
        for (Target target : inLine.subList(0, Math.min(weapon.pierce(), inLine.size()))) {
            hits++;
            if (target.zombie().hit(weapon.damage(), dirX * knockback, dirY * knockback, now)) {
                kills++;
            }
        }

        BossZombie bossTarget = boss;
        if (hits < weapon.pierce() && bossTarget != null && bossTarget.isAlive()
                && bossTarget.getFloor() == player.getFloor()
                && alongRay(bossTarget.getX() - x, bossTarget.getY() - y, dirX, dirY,
                        BOSS_BULLET_HIT_RADIUS_PX, maxReach) >= 0) {
            hits++;
            bossKills += hitBoss(player, bossTarget, weapon.damage(), false, now);
        }
        return payKills(player, hits, kills, bossKills);
    }

    /** Distancia sobre el rayo hasta el punto (dx, dy) si lo toca dentro del radio, o -1. */
    private static double alongRay(double dx, double dy, double dirX, double dirY, double radius, double maxReach) {
        double along = dx * dirX + dy * dirY;
        if (along < 0 || along > maxReach + radius) {
            return -1;
        }
        double perpendicular = Math.abs(dx * dirY - dy * dirX);
        return perpendicular <= radius ? along : -1;
    }

    private int hitBoss(Player player, BossZombie target, int damage, boolean charged, long now) {
        if (!target.hit(damage, charged, now)) {
            return 0;
        }
        player.addEarnings(BOSS_REWARD_GARAVITOS);
        waveDirector.onBossDefeated(now);
        return 1;
    }

    /** Paga los zombis comunes muertos (el jefe ya se pago en {@link #hitBoss}). */
    private AttackResult payKills(Player player, int hits, int zombieKills, int bossKills) {
        if (zombieKills > 0) {
            player.addEarnings(zombieKills * GARAVITOS_PER_ZOMBIE);
            waveDirector.onZombiesKilled(zombieKills);
        }
        player.addCandies(candiesFor(zombieKills, bossKills, java.util.concurrent.ThreadLocalRandom.current()));
        player.recordKills(zombieKills + bossKills);
        return AttackResult.ok(hits, zombieKills + bossKills);
    }

    public PlayerActionResult attemptEquip(String playerId, String itemId) {
        Player player = players.get(playerId);
        if (player == null) {
            return PlayerActionResult.rejected("unknown_player");
        }
        Weapon weapon = itemId == null || itemId.isBlank() ? Weapon.FISTS : Weapon.fromItemId(itemId);
        if (weapon == null || !player.equip(weapon)) {
            return PlayerActionResult.rejected("not_owned");
        }
        return PlayerActionResult.ok();
    }

    public PlayerActionResult attemptReload(String playerId) {
        Player player = players.get(playerId);
        if (player == null) {
            return PlayerActionResult.rejected("unknown_player");
        }
        if (!player.isAlive()) {
            return PlayerActionResult.rejected("downed");
        }
        String reason = player.startReload(System.currentTimeMillis());
        return reason == null ? PlayerActionResult.ok() : PlayerActionResult.rejected(reason);
    }

    public UseItemResult attemptUseItem(String playerId, String itemId) {
        Player player = players.get(playerId);
        if (player == null) {
            return UseItemResult.rejected("unknown_player");
        }
        if (!player.isAlive()) {
            return UseItemResult.rejected("downed");
        }

        ShopItem shopItem = ShopCatalog.itemById(itemId);
        int heal = shopItem != null ? shopItem.healAmount() : FOOD_HEALTH_BONUS;
        if (player.consumeFood(itemId) == null) {
            return UseItemResult.rejected("not_usable");
        }
        player.heal(heal);
        return UseItemResult.ok();
    }

    private static double wrapAngle(double radians) {
        return Math.IEEEremainder(radians, 2 * Math.PI);
    }

    public PurchaseResult attemptPurchase(String playerId, String itemId, double x, double y) {
        Player player = players.get(playerId);
        if (player == null) {
            return PurchaseResult.rejected("unknown_player");
        }

        ShopItem item = ShopCatalog.itemById(itemId);
        ShopVendor vendor = ShopCatalog.vendorSelling(itemId);
        if (item == null || vendor == null) {
            return PurchaseResult.rejected("unknown_item");
        }

        double dx = player.getX() - vendor.x();
        double dy = player.getY() - vendor.y();
        if (vendor.floor() != player.getFloor() || Math.sqrt(dx * dx + dy * dy) > SHOP_RANGE_PX) {
            return PurchaseResult.rejected("too_far");
        }

        return player.purchase(priceFor(player, item.price()), new InventorySlot(item.type(), item.itemId(), item.itemName()));
    }

    public MissionResult attemptStartMission(String playerId, String missionId) {
        Player player = players.get(playerId);
        if (player == null) {
            return MissionResult.rejected("unknown_player");
        }
        if (!player.isAlive()) {
            return MissionResult.rejected("downed");
        }
        if (missionBoard.pending(playerId, missionId) == null) {
            return MissionResult.rejected("unknown_mission");
        }
        player.setInvulnerable(true);
        return MissionResult.ok(0);
    }

    public MissionResult attemptCancelMission(String playerId, String missionId) {
        Player player = players.get(playerId);
        if (player == null) {
            return MissionResult.rejected("unknown_player");
        }

        player.setInvulnerable(false);
        return MissionResult.ok(0);
    }

    public MissionResult attemptCompleteMission(String playerId, String missionId, double x, double y) {
        Player player = players.get(playerId);
        if (player == null) {
            return MissionResult.rejected("unknown_player");
        }

        player.setInvulnerable(false);

        MissionView mission = missionBoard.pending(playerId, missionId);
        if (mission == null) {
            return MissionResult.rejected("unknown_mission");
        }

        double dx = player.getX() - mission.x();
        double dy = player.getY() - mission.y();
        if (mission.floor() != player.getFloor() || Math.sqrt(dx * dx + dy * dy) > MISSION_RANGE_PX) {
            return MissionResult.rejected("too_far");
        }

        if (!missionBoard.complete(playerId, missionId)) {
            return MissionResult.rejected("unknown_mission");
        }
        player.addEarnings(mission.reward());
        player.recordMission();
        return MissionResult.ok(mission.reward());
    }

    /** Misiones asignadas al jugador en el Kinder actual. */
    public List<MissionView> missionsOf(String playerId) {
        return missionBoard.viewFor(playerId);
    }

    public Set<String> claimedItemIdsSnapshot() {
        return new HashSet<>(claimedItems.keySet());
    }

    public DoorToggleResult attemptToggleDoor(String playerId, String doorId, double x, double y) {
        Player player = players.get(playerId);
        if (player == null) {
            return DoorToggleResult.rejected("unknown_player");
        }

        FloorGrid grid = floors.stream()
                .filter(candidate -> candidate.doors().stream().anyMatch(d -> d.doorId().equals(doorId)))
                .findFirst()
                .orElse(null);
        if (grid == null) {
            return DoorToggleResult.rejected("unknown_door");
        }
        FloorGrid.DoorSpec spec = grid.doors().stream().filter(d -> d.doorId().equals(doorId)).findFirst().orElseThrow();

        double dx = player.getX() - spec.centerX();
        double dy = player.getY() - spec.centerY();
        if (floors.indexOf(grid) + 1 != player.getFloor() || Math.sqrt(dx * dx + dy * dy) > DOOR_INTERACT_RANGE_PX) {
            return DoorToggleResult.rejected("too_far");
        }

        boolean nowOpen = !grid.isDoorOpen(doorId);
        grid.setDoorOpen(doorId, nowOpen);
        return DoorToggleResult.ok(nowOpen);
    }

    public List<DoorState> doorStates() {
        return floors.stream()
                .flatMap(grid -> grid.doors().stream().map(spec -> new DoorState(spec.doorId(), grid.isDoorOpen(spec.doorId()))))
                .toList();
    }

    public void resetGame() {
        zombies.clear();
        acids.clear();
        puddles.clear();
        boss = null;
        // Antes se reusaba el respiro corto entre oleadas y la preparacion de 45 s
        // nunca llegaba a aplicarse: el HUD mostraba "oleada 1 en 1s" al empezar.
        waveDirector.resetRun(System.currentTimeMillis(), FIRST_WAVE_PREP_MS);
        claimedItems.clear();
        missionBoard.reset();
        barricades.clear();
        activeEvent = null;
        nextEventAt = 0;
        eventKinder = 0;
        runStartedAt = System.currentTimeMillis();
        lastSummary = null;
        floors.forEach(FloorGrid::resetDoors);
        players.values().forEach(Player::reset);
        wipedRun = false;
        victoryPending = false;
        pendingEvents.clear();
    }
}
