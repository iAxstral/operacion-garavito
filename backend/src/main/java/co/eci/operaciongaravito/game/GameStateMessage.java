package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Set;

public record GameStateMessage(
        List<PlayerState> players,
        Set<String> claimedItemIds,
        LastEvent lastEvent,
        RoundState round,
        List<ZombieState> zombies,
        WaveState wave,
        List<DoorState> doors,
        LobbyState lobby) {

    public static GameStateMessage eventOnly(LastEvent event) {
        return new GameStateMessage(List.of(), Set.of(), event, null, List.of(), null, List.of(), null);
    }
}
