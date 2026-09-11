package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Set;

/** Payload unico que se difunde por /topic/game/{gameId} para join, pickup y decide/round. */
public record GameStateMessage(List<PlayerState> players, Set<String> claimedItemIds, LastEvent lastEvent, RoundState round) {
}
