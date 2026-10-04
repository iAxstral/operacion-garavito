package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Set;

public record GameStateMessage(
        List<PlayerState> players,
        Set<String> claimedItemIds,
        LastEvent lastEvent,
        List<ZombieState> zombies,
        WaveState wave,
        List<DoorState> doors,
        LobbyState lobby,
        BossView boss,
        List<ProjectileState> projectiles) {

    public static GameStateMessage eventOnly(LastEvent event) {
        return new GameStateMessage(List.of(), Set.of(), event, List.of(), null, List.of(), null, null, List.of());
    }
}
