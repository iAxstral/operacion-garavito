package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Set;

/** Payload unico que se difunde por /topic/game/{gameId} para join y pickup. */
public record GameStateMessage(List<PlayerState> players, Set<String> claimedItemIds, LastEvent lastEvent) {
}
