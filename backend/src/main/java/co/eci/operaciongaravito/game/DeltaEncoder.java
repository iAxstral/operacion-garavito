package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Hace mas livianos los mensajes de estado de una sala (ver docs/ESCALABILIDAD.md, 4.1).
 *
 * <p>El estado completo se arma igual que siempre, pero antes de enviarlo:
 * <ul>
 *   <li>Las partes que casi nunca cambian (objetos recogidos, puertas, sala, barricadas,
 *   resumen, evento del Kinder) se omiten si son iguales a las ultimas enviadas y se
 *   nombran en {@code unchanged}; el cliente conserva las que ya tenia.</li>
 *   <li>De cada jugador se omite lo que casi nunca cambia (inventario, misiones, apodo y
 *   disfraz) si es igual a lo ultimo enviado, marcandolo con {@code staticOmitted}.</li>
 * </ul>
 * Cada {@link #KEYFRAME_EVERY} mensajes (y cuando alguien entra o vuelve) va el estado
 * completo, para que un cliente que llega tarde o perdio un mensaje se ponga al dia.
 *
 * <p>Concurrencia: a una sala le difunden el tick y los hilos de mensajes STOMP; todo
 * pasa por {@link #encode}, que esta sincronizado.
 */
public class DeltaEncoder {

    /** Con un mensaje cada 125 ms, uno completo cada 2 s. */
    public static final int KEYFRAME_EVERY = 16;

    private record PlayerStatic(List<InventorySlot> inventory, List<MissionView> missions, String name, String costume,
                                List<String> perks, List<String> perkOffer) {
        static PlayerStatic of(PlayerState state) {
            return new PlayerStatic(state.inventory(), state.missions(), state.name(), state.costume(), state.perks(),
                    state.perkOffer());
        }
    }

    private GameStateMessage last;
    private final Map<String, PlayerStatic> lastStatic = new HashMap<>();
    private int sinceKeyframe = KEYFRAME_EVERY;

    public synchronized GameStateMessage encode(GameStateMessage full, boolean forceFull) {
        boolean keyframe = forceFull || last == null || ++sinceKeyframe >= KEYFRAME_EVERY;
        GameStateMessage previous = last;
        last = full;
        if (keyframe) {
            sinceKeyframe = 0;
            lastStatic.clear();
            full.players().forEach(p -> lastStatic.put(p.playerId(), PlayerStatic.of(p)));
            return full;
        }

        List<String> unchanged = new ArrayList<>();
        boolean sameClaimed = Objects.equals(full.claimedItemIds(), previous.claimedItemIds());
        boolean sameDoors = Objects.equals(full.doors(), previous.doors());
        boolean sameLobby = Objects.equals(full.lobby(), previous.lobby());
        boolean sameBarricades = Objects.equals(full.barricades(), previous.barricades());
        boolean sameSummary = Objects.equals(full.summary(), previous.summary());
        boolean sameEvent = Objects.equals(full.event(), previous.event());
        if (sameClaimed) unchanged.add("claimedItemIds");
        if (sameDoors) unchanged.add("doors");
        if (sameLobby) unchanged.add("lobby");
        if (sameBarricades) unchanged.add("barricades");
        if (sameSummary) unchanged.add("summary");
        if (sameEvent) unchanged.add("event");

        List<PlayerState> players = new ArrayList<>();
        for (PlayerState player : full.players()) {
            PlayerStatic now = PlayerStatic.of(player);
            if (now.equals(lastStatic.get(player.playerId()))) {
                players.add(player.withoutStatic());
            } else {
                lastStatic.put(player.playerId(), now);
                players.add(player);
            }
        }

        return new GameStateMessage(
                players,
                sameClaimed ? null : full.claimedItemIds(),
                full.lastEvent(),
                full.zombies(),
                full.wave(),
                sameDoors ? null : full.doors(),
                sameLobby ? null : full.lobby(),
                full.boss(),
                full.projectiles(),
                sameBarricades ? null : full.barricades(),
                sameSummary ? null : full.summary(),
                sameEvent ? null : full.event(),
                full.puddles(),
                full.blasts(),
                unchanged,
                false);
    }
}
