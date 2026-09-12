package co.eci.operaciongaravito.game;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.function.Consumer;

/**
 * Una partida activa: hasta 4 jugadores (uno por rol) + el catalogo de
 * items del piso 1 + que items ya fueron reclamados.
 *
 * Concurrencia (dos jugadores recogiendo el mismo item a la vez): se
 * resuelve con {@code claimedItems.putIfAbsent}, no con un lock explicito.
 * putIfAbsent es atomico — el primer hilo en llamarlo para un itemId dado
 * es, por definicion, el unico que puede recibir null como retorno, sin
 * ventana de carrera entre "leer si esta libre" y "marcarlo como mio"
 * (eso es exactamente lo que un check-then-act no atomico rompe). Si la
 * validacion posterior (inventario lleno) falla, se libera el reclamo con
 * el remove condicional de 2 argumentos (tambien atomico) para no dejar el
 * item perdido para siempre.
 */
public class GameSession {

    private static final double PICKUP_RANGE_PX = 110; // ~1.7 tiles de holgura
    private static final int FOOD_HEALTH_BONUS = 15;
    private static final double SHOP_RANGE_PX = 110; // mismo orden que PICKUP_RANGE_PX
    private static final double MISSION_RANGE_PX = 90;
    private static final long MISSION_COOLDOWN_MS = 60_000;

    // --- Zombis (ver GAMEPLAY.md) ---
    private static final int GARAVITOS_PER_ZOMBIE = 1;
    private static final double ATTACK_HALF_ARC_RAD = Math.toRadians(45);

    /**
     * Como pega el jugador segun con que. Desarmado SIEMPRE se puede pegar:
     * es lento, corto y necesita dos golpes, pero hace que el juego nunca
     * quede sin salida — antes, sin arma no habia absolutamente ninguna forma
     * de matar un zombi, y el arma estaba detras de una mision y una caminata.
     * El hacha sigue siendo una mejora clara, no la diferencia entre jugar y
     * no jugar.
     */
    private record Melee(int damage, double range, long cooldownMs, double knockback) {
    }

    private static final Melee UNARMED = new Melee(1, 48, 700, 170);
    private static final Melee ARMED = new Melee(2, 62, 400, 280);
    private static final double CONTACT_RANGE_PX = 40;
    private static final double SEPARATION_RADIUS_PX = 26;
    private static final double SEPARATION_FORCE = 90;
    /** Se vuelve a arrancar la corrida con el equipo entero, no a medias. */
    private static final int REVIVE_HEALTH = 100;

    private final String gameId;
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Map<String, WorldItem> worldItems = WorldItemCatalog.defaultCatalog();
    private final Map<String, String> claimedItems = new ConcurrentHashMap<>(); // itemId -> playerId
    private final Map<String, Long> missionCooldowns = new ConcurrentHashMap<>(); // missionId -> ultimo completado (millis)
    private final RoundCoordinator roundCoordinator;
    private final Map<String, Zombie> zombies = new ConcurrentHashMap<>();
    private final WaveDirector waveDirector;
    private final FloorGrid floor = FloorGrid.floor1();
    /** Se consume en el proximo broadcast para avisar del wipe una sola vez. */
    private volatile boolean wipedRun = false;

    /**
     * @param onRoundResolved se invoca cada vez que el RoundCoordinator resuelve
     *                        una ronda (por las 4 decisiones o por timeout) — el
     *                        llamador (GameSessionService) lo usa para difundir
     *                        el resultado, incluyendo el caso de timeout, que no
     *                        ocurre como respuesta directa a ningun mensaje STOMP
     *                        entrante y por eso necesita su propio disparador de
     *                        broadcast.
     */
    public GameSession(String gameId, ScheduledExecutorService scheduler, Consumer<RoundState> onRoundResolved) {
        this.gameId = gameId;
        this.roundCoordinator = new RoundCoordinator(scheduler, onRoundResolved);
        // Un respiro antes de la primera oleada, para que quien entra alcance
        // a ubicarse en el mapa antes de que aparezca el primer zombi.
        this.waveDirector = new WaveDirector(System.currentTimeMillis(), 4_000);
    }

    public boolean hasPlayers() {
        return !players.isEmpty();
    }

    public String getGameId() {
        return gameId;
    }

    public Player getOrCreatePlayer(String role) {
        Role.valueOf(role); // lanza IllegalArgumentException si el rol no es valido
        return players.computeIfAbsent(role, Player::new);
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

        String claimedBy = claimedItems.putIfAbsent(itemId, playerId);
        if (claimedBy != null) {
            return PickupResult.rejected("already_claimed");
        }

        double dx = x - item.x();
        double dy = y - item.y();
        if (Math.sqrt(dx * dx + dy * dy) > PICKUP_RANGE_PX) {
            claimedItems.remove(itemId, playerId); // liberar: no era valido, que otro lo intente
            return PickupResult.rejected("too_far");
        }

        boolean added = player.tryAddItem(new InventorySlot(item.type(), item.itemId(), item.itemName()));
        if (!added) {
            claimedItems.remove(itemId, playerId); // liberar: inventario lleno, no se pierde el item
            return PickupResult.rejected("inventory_full");
        }

        if (item.type() == ItemType.FOOD) {
            player.heal(FOOD_HEALTH_BONUS);
        }

        return PickupResult.ok();
    }

    public List<PlayerState> playerStates() {
        return players.values().stream()
                .map(p -> new PlayerState(p.getPlayerId(), p.getRole(), p.getHealth(), p.getGaravitos(),
                        p.inventorySnapshot(), Math.round(p.getX()), Math.round(p.getY()), p.getLifeState()))
                .toList();
    }

    public void reportPosition(String playerId, double x, double y) {
        Player player = players.get(playerId);
        if (player != null) {
            player.reportPosition(x, y);
        }
    }

    public List<ZombieState> zombieStates() {
        return zombies.values().stream().map(Zombie::toState).toList();
    }

    /** True (una sola vez) si acaba de caer el equipo completo. */
    public boolean consumeWipedRun() {
        boolean value = wipedRun;
        wipedRun = false;
        return value;
    }

    public WaveState waveState() {
        long now = System.currentTimeMillis();
        return new WaveState(waveDirector.getWave(), waveDirector.remaining(aliveZombieCount()), waveDirector.restingSeconds(now));
    }

    private int aliveZombieCount() {
        return (int) zombies.values().stream().filter(Zombie::isAlive).count();
    }

    /**
     * Un paso de simulacion: spawn de la oleada, persecucion, mordidas y
     * limpieza de cadaveres. Lo llama solo el hilo del tick.
     */
    public void tick(long now, double deltaSeconds) {
        Zombie spawned = waveDirector.update(now, aliveZombieCount(), players.values());
        if (spawned != null) {
            zombies.put(spawned.getId(), spawned);
        }

        List<Player> targets = players.values().stream().filter(Player::isAlive).toList();

        // Equipo completo caido: se pierde la corrida y se vuelve a la oleada
        // 1. Ese es el costo de morir. Sin este bloque la partida ademas se
        // congelaria para siempre — sin nadie vivo los zombis no tienen a
        // quien perseguir, la oleada no se limpia nunca y nadie revive.
        if (targets.isEmpty() && !players.isEmpty()) {
            zombies.clear();
            waveDirector.resetRun(now);
            players.values().forEach(player -> player.revive(REVIVE_HEALTH));
            wipedRun = true;
            return;
        }

        List<Zombie> living = zombies.values().stream().filter(Zombie::isAlive).toList();

        for (Zombie zombie : living) {
            Player target = nearestPlayer(zombie, targets);
            if (target == null) {
                continue;
            }
            double[] separation = separationFor(zombie, living);
            zombie.step(floor, target.getX(), target.getY(), separation[0], separation[1], deltaSeconds, now);

            if (Math.hypot(target.getX() - zombie.getX(), target.getY() - zombie.getY()) <= CONTACT_RANGE_PX) {
                zombie.tryBite(target, now);
            }
        }

        // Los muertos se retiran del mapa aca y no en el momento del golpe:
        // asi el cliente alcanza a recibir al menos un broadcast con el zombi
        // ya sin vida y puede animar la muerte en vez de desaparecerlo.
        zombies.values().removeIf(zombie -> !zombie.isAlive());

        if (waveDirector.restingSeconds(now) > 0) {
            players.values().forEach(player -> {
                if (!player.isAlive()) {
                    player.revive(REVIVE_HEALTH);
                }
            });
        }
    }

    private Player nearestPlayer(Zombie zombie, List<Player> candidates) {
        Player nearest = null;
        double best = Double.MAX_VALUE;
        for (Player candidate : candidates) {
            double distance = Math.hypot(candidate.getX() - zombie.getX(), candidate.getY() - zombie.getY());
            if (distance < best) {
                best = distance;
                nearest = candidate;
            }
        }
        return nearest;
    }

    /** Empuje entre zombis cercanos, para que la horda no se apile en un punto. */
    private double[] separationFor(Zombie zombie, List<Zombie> others) {
        double sx = 0;
        double sy = 0;
        for (Zombie other : others) {
            if (other == zombie) {
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

    /**
     * Golpe de arma cuerpo a cuerpo. El servidor valida arma, cooldown,
     * alcance y arco; el cliente solo pide y anima.
     */
    public AttackResult attemptAttack(String playerId, double x, double y, double facing) {
        Player player = players.get(playerId);
        if (player == null) {
            return AttackResult.rejected("unknown_player");
        }
        if (!player.isAlive()) {
            return AttackResult.rejected("downed");
        }

        Melee melee = player.hasWeapon() ? ARMED : UNARMED;
        long now = System.currentTimeMillis();
        if (!player.tryConsumeAttackCooldown(now, melee.cooldownMs())) {
            return AttackResult.rejected("on_cooldown");
        }

        player.reportPosition(x, y);

        int hits = 0;
        int kills = 0;
        for (Zombie zombie : zombies.values()) {
            if (!zombie.isAlive()) {
                continue;
            }
            double dx = zombie.getX() - x;
            double dy = zombie.getY() - y;
            if (Math.hypot(dx, dy) > melee.range()) {
                continue;
            }
            double angleToZombie = Math.atan2(dy, dx);
            if (Math.abs(wrapAngle(angleToZombie - facing)) > ATTACK_HALF_ARC_RAD) {
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
        }
        return AttackResult.ok(hits, kills);
    }

    /** Normaliza un angulo a [-PI, PI], para poder compararlo con el medio arco. */
    private static double wrapAngle(double radians) {
        return Math.IEEEremainder(radians, 2 * Math.PI);
    }

    /**
     * Compra en un vendedor de stock ilimitado (vendedora/maquina). A
     * diferencia de attemptPickup, no hay reclamo cruzado entre jugadores
     * que resolver (los Garavitos y el inventario son de UN jugador) — toda
     * la atomicidad la da Player.purchase(...). La validacion de distancia
     * es contra la posicion del VENDEDOR que vende ese item, no del item
     * (los ShopItem no tienen posicion propia — ver ShopItem/ShopVendor).
     */
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
        if (Math.sqrt(dx * dx + dy * dy) > SHOP_RANGE_PX) {
            return PurchaseResult.rejected("too_far");
        }

        return player.purchase(item.price(), new InventorySlot(item.type(), item.itemId(), item.itemName()), item.healAmount());
    }

    /**
     * Completar una mision: reclamo atomico del "turno" de cooldown con
     * Map.compute (no putIfAbsent — a diferencia de un item del mapa, una
     * mision se puede volver a reclamar despues del cooldown, no una sola
     * vez para siempre).
     */
    public MissionResult attemptCompleteMission(String playerId, String missionId, double x, double y) {
        Player player = players.get(playerId);
        if (player == null) {
            return MissionResult.rejected("unknown_player");
        }

        MissionZone mission = MissionCatalog.byId(missionId);
        if (mission == null) {
            return MissionResult.rejected("unknown_mission");
        }

        if (!mission.role().equals(player.getRole())) {
            return MissionResult.rejected("wrong_role");
        }

        double dx = x - mission.x();
        double dy = y - mission.y();
        if (Math.sqrt(dx * dx + dy * dy) > MISSION_RANGE_PX) {
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

    /** @throws IllegalArgumentException si role no es uno de los 4 roles validos */
    public void submitDecision(String role, String action) {
        roundCoordinator.submitDecision(role, action);
    }

    public RoundState currentRoundView() {
        return roundCoordinator.currentStateView();
    }
}
