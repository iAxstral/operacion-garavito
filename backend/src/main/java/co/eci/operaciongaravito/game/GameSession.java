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

    private final String gameId;
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Map<String, WorldItem> worldItems = WorldItemCatalog.defaultCatalog();
    private final Map<String, String> claimedItems = new ConcurrentHashMap<>(); // itemId -> playerId
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
                .map(p -> new PlayerState(p.getPlayerId(), p.getRole(), p.getHealth(), p.inventorySnapshot()))
                .toList();
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
