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

    private final String gameId;
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Map<String, WorldItem> worldItems = WorldItemCatalog.defaultCatalog();
    private final Map<String, String> claimedItems = new ConcurrentHashMap<>(); // itemId -> playerId
    private final Map<String, Long> missionCooldowns = new ConcurrentHashMap<>(); // missionId -> ultimo completado (millis)
    private final RoundCoordinator roundCoordinator;

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
                .map(p -> new PlayerState(p.getPlayerId(), p.getRole(), p.getHealth(), p.getGaravitos(), p.inventorySnapshot()))
                .toList();
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
