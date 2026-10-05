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
                            missionBoard.viewFor(p.getPlayerId()), p.abilityReadyInMs(now), p.isConnected());
                })
                .toList();
    }

    /**
     * Posicion que reporta el cliente. Devuelve false si se rechazo (movimiento
     * imposible): el jugador queda donde el servidor lo tenia.
     */
    public boolean reportPosition(String playerId, int floor, double x, double y) {
        Player player = players.get(playerId);
        // Un caido se queda donde cayo: su cliente pasa a modo espectador.
        if (player == null || !player.isAlive() || !building.hasFloor(floor)) {
            return true;
        }
        long now = System.currentTimeMillis();
        if (!isValidMove(player, floor, x, y, now)) {
            player.countRejectedMove();
            return false;
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
            boss = null;
            if (waveDirector.isVictory()) {
                victoryPending = true;
            }
        }

        List<Player> targets = players.values().stream().filter(Player::isAlive).toList();

        if (targets.isEmpty() && !players.isEmpty()) {
            zombies.clear();
            acids.clear();
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
            Player target = nearestPlayer(zombie, targets);
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

        zombies.values().removeIf(zombie -> !zombie.isAlive());
        updateBoss(now, deltaSeconds, targets);
        updateRevives(now);
        updateBarricades(deltaSeconds);

        if (waveDirector.restingSeconds(now) > 0) {
            players.values().forEach(player -> {
                if (!player.isAlive()) {
                    player.revive(REVIVE_HEALTH);
                }
            });
        }
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

        long now = System.currentTimeMillis();
        // El origen del golpe es la posicion del servidor, salvo una diferencia chica
        // (el ataque puede llegar antes que el ultimo reporte de movimiento).
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
        player.addGaravitos(BOSS_REWARD_GARAVITOS);
        waveDirector.onBossDefeated(now);
        return 1;
    }

    /** Paga los zombis comunes muertos (el jefe ya se pago en {@link #hitBoss}). */
    private AttackResult payKills(Player player, int hits, int zombieKills, int bossKills) {
        if (zombieKills > 0) {
            player.addGaravitos(zombieKills * GARAVITOS_PER_ZOMBIE);
            waveDirector.onZombiesKilled(zombieKills);
        }
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
        player.addGaravitos(mission.reward());
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
        boss = null;
        // Antes se reusaba el respiro corto entre oleadas y la preparacion de 45 s
        // nunca llegaba a aplicarse: el HUD mostraba "oleada 1 en 1s" al empezar.
        waveDirector.resetRun(System.currentTimeMillis(), FIRST_WAVE_PREP_MS);
        claimedItems.clear();
        missionBoard.reset();
        barricades.clear();
        floors.forEach(FloorGrid::resetDoors);
        players.values().forEach(Player::reset);
        wipedRun = false;
        victoryPending = false;
        pendingEvents.clear();
    }
}
