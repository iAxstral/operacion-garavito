package co.eci.operaciongaravito.game;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.function.Consumer;

public class GameSession {

    private static final double PICKUP_RANGE_PX = 110;
    private static final int FOOD_HEALTH_BONUS = 15;
    private static final double SHOP_RANGE_PX = 110;
    private static final double MISSION_RANGE_PX = 90;
    private static final long MISSION_COOLDOWN_MS = 60_000;
    private static final double DOOR_INTERACT_RANGE_PX = 90;

    private static final int GARAVITOS_PER_ZOMBIE = 1;

    private static final double ATTACK_HALF_ARC_RAD = Math.toRadians(55);

    private record Melee(int damage, double range, long cooldownMs, double knockback) {
    }

    private static final Melee UNARMED = new Melee(1, 56, 700, 170);
    private static final Melee ARMED = new Melee(2, 70, 400, 280);
    private static final Melee CHARGED = new Melee(4, 150, 0, 520);
    private static final long CHARGED_COOLDOWN_MS = 6_000;
    private static final double CONTACT_RANGE_PX = 40;
    private static final double SEPARATION_RADIUS_PX = 26;
    private static final double SEPARATION_FORCE = 90;

    private static final int REVIVE_HEALTH = 100;

    private final String gameId;
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Map<String, WorldItem> worldItems = WorldItemCatalog.defaultCatalog();
    private final Map<String, String> claimedItems = new ConcurrentHashMap<>();
    private final Map<String, Long> missionCooldowns = new ConcurrentHashMap<>();
    private final RoundCoordinator roundCoordinator;
    private final Map<String, Zombie> zombies = new ConcurrentHashMap<>();
    private final WaveDirector waveDirector;
    private final Building building;
    private final List<FloorGrid> floors;

    private volatile boolean wipedRun = false;
    private volatile boolean victoryPending = false;
    private volatile boolean started = false;
    private volatile String host;

    // Al arrancar la partida los jugadores tienen que poder hacer sus misiones y comprar
    // recursos antes de que llegue la primera oleada — 4s no alcanzaba para eso.
    private static final long FIRST_WAVE_PREP_MS = 45_000;

    public GameSession(String gameId, Building building, ScheduledExecutorService scheduler,
                       Consumer<RoundState> onRoundResolved) {
        this.gameId = gameId;
        this.building = building;
        this.floors = java.util.stream.IntStream.rangeClosed(1, building.floorCount())
                .mapToObj(floor -> FloorGrid.forFloor(building, floor))
                .toList();
        this.roundCoordinator = new RoundCoordinator(scheduler, onRoundResolved);

        this.waveDirector = new WaveDirector(System.currentTimeMillis(), FIRST_WAVE_PREP_MS, floors);
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
        try {
            Role.valueOf(role);
        } catch (IllegalArgumentException | NullPointerException ex) {
            return "invalid_role";
        }
        if (players.containsKey(role)) {
            return "role_taken";
        }
        getOrCreatePlayer(role);
        if (host == null) {
            host = role;
        }
        return null;
    }

    public synchronized void removePlayer(String role) {
        players.remove(role);
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

        double dx = x - item.x();
        double dy = y - item.y();
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
        return players.values().stream()
                .map(p -> new PlayerState(p.getPlayerId(), p.getRole(), p.getHealth(), p.getGaravitos(),
                        p.inventorySnapshot(), p.getFloor(), Math.round(p.getX()), Math.round(p.getY()),
                        p.getLifeState(), p.isInvulnerable(), p.chargedReadyInMs(System.currentTimeMillis())))
                .toList();
    }

    public void reportPosition(String playerId, int floor, double x, double y) {
        Player player = players.get(playerId);
        if (player != null && building.hasFloor(floor)) {
            player.reportPosition(floor, x, y);
        }
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
        return waveDirector.state(System.currentTimeMillis());
    }

    private int aliveZombieCount() {
        return (int) zombies.values().stream().filter(Zombie::isAlive).count();
    }

    public void tick(long now, double deltaSeconds) {
        if (!started) {
            return;
        }
        waveDirector.update(now, aliveZombieCount(), players.values())
                .forEach(spawned -> zombies.put(spawned.getId(), spawned));
        if (waveDirector.consumeJustCleared()) {
            // Cuota cumplida: la horda que quedaba se retira y empieza el respiro.
            zombies.clear();
            if (waveDirector.isVictory()) {
                victoryPending = true;
            }
        }

        List<Player> targets = players.values().stream().filter(Player::isAlive).toList();

        if (targets.isEmpty() && !players.isEmpty()) {
            zombies.clear();
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
                continue;
            }
            double[] separation = separationFor(zombie, living);
            zombie.step(floorGrid(zombie.getFloor()), fields.get(target.getPlayerId()), target.getX(), target.getY(),
                    separation[0], separation[1], deltaSeconds, now);

            if (Math.hypot(target.getX() - zombie.getX(), target.getY() - zombie.getY()) <= CONTACT_RANGE_PX) {
                zombie.tryBite(target, now);
            }
        }

        zombies.values().removeIf(zombie -> !zombie.isAlive());

        if (waveDirector.restingSeconds(now) > 0) {
            players.values().forEach(player -> {
                if (!player.isAlive()) {
                    player.revive(REVIVE_HEALTH);
                }
            });
        }
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
        boolean charged = type == AttackType.CHARGED;
        Melee melee;
        if (charged) {
            melee = CHARGED;
            if (!player.tryConsumeChargedCooldown(now, CHARGED_COOLDOWN_MS)) {
                return AttackResult.rejected("on_cooldown");
            }
        } else {
            melee = player.hasWeapon() ? ARMED : UNARMED;
            if (!player.tryConsumeAttackCooldown(now, melee.cooldownMs())) {
                return AttackResult.rejected("on_cooldown");
            }
        }

        player.reportPosition(x, y);

        int hits = 0;
        int kills = 0;
        for (Zombie zombie : zombies.values()) {
            if (!zombie.isAlive() || zombie.getFloor() != player.getFloor()) {
                continue;
            }
            double dx = zombie.getX() - x;
            double dy = zombie.getY() - y;
            if (Math.hypot(dx, dy) > melee.range()) {
                continue;
            }
            double angleToZombie = Math.atan2(dy, dx);
            if (!charged && Math.abs(wrapAngle(angleToZombie - facing)) > ATTACK_HALF_ARC_RAD) {
                continue;
            }

            hits++;
            double knockback = melee.knockback();
            if (zombie.hit(melee.damage(), Math.cos(angleToZombie) * knockback, Math.sin(angleToZombie) * knockback, now)) {
                kills++;
            }
        }

        if (kills > 0) {
            player.addGaravitos(kills * GARAVITOS_PER_ZOMBIE);
            waveDirector.onZombiesKilled(kills);
        }
        return AttackResult.ok(hits, kills);
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

        double dx = x - vendor.x();
        double dy = y - vendor.y();
        if (vendor.floor() != player.getFloor() || Math.sqrt(dx * dx + dy * dy) > SHOP_RANGE_PX) {
            return PurchaseResult.rejected("too_far");
        }

        return player.purchase(item.price(), new InventorySlot(item.type(), item.itemId(), item.itemName()));
    }

    public MissionResult attemptStartMission(String playerId, String missionId) {
        Player player = players.get(playerId);
        if (player == null) {
            return MissionResult.rejected("unknown_player");
        }

        MissionZone mission = MissionCatalog.byId(building, missionId);
        if (mission == null) {
            return MissionResult.rejected("unknown_mission");
        }
        if (!mission.role().equals(player.getRole())) {
            return MissionResult.rejected("wrong_role");
        }

        Long lastCompletedAt = missionCooldowns.get(missionId);
        if (lastCompletedAt != null && System.currentTimeMillis() - lastCompletedAt < MISSION_COOLDOWN_MS) {
            return MissionResult.rejected("on_cooldown");
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

        MissionZone mission = MissionCatalog.byId(building, missionId);
        if (mission == null) {
            return MissionResult.rejected("unknown_mission");
        }

        if (!mission.role().equals(player.getRole())) {
            return MissionResult.rejected("wrong_role");
        }

        double dx = x - mission.x();
        double dy = y - mission.y();
        if (mission.floor() != player.getFloor() || Math.sqrt(dx * dx + dy * dy) > MISSION_RANGE_PX) {
            return MissionResult.rejected("too_far");
        }

        long now = System.currentTimeMillis();
        boolean[] granted = { false };
        missionCooldowns.compute(missionId, (key, lastCompletedAt) -> {
            if (lastCompletedAt == null || now - lastCompletedAt >= MISSION_COOLDOWN_MS) {
                granted[0] = true;
                return now;
            }
            return lastCompletedAt;
        });

        if (!granted[0]) {
            return MissionResult.rejected("on_cooldown");
        }

        player.addGaravitos(mission.rewardGaravitos());
        return MissionResult.ok(mission.rewardGaravitos());
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

        double dx = x - spec.centerX();
        double dy = y - spec.centerY();
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

    public void submitDecision(String role, String action) {
        roundCoordinator.submitDecision(role, action);
    }

    public RoundState currentRoundView() {
        return roundCoordinator.currentStateView();
    }

    public void resetGame() {
        zombies.clear();
        // Antes se reusaba el respiro corto entre oleadas y la preparacion de 45 s
        // nunca llegaba a aplicarse: el HUD mostraba "oleada 1 en 1s" al empezar.
        waveDirector.resetRun(System.currentTimeMillis(), FIRST_WAVE_PREP_MS);
        claimedItems.clear();
        missionCooldowns.clear();
        floors.forEach(FloorGrid::resetDoors);
        players.values().forEach(Player::reset);
        roundCoordinator.reset();
        wipedRun = false;
        victoryPending = false;
    }
}
