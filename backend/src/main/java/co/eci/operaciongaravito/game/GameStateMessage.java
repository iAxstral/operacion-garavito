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
        List<ProjectileState> projectiles,
        List<BarricadeState> barricades,
        MatchSummary summary,
        KinderEvent event,
        List<PuddleState> puddles,
        List<String> unchanged,
        boolean full) {

    /** Estado completo (sin omitir nada). */
    public GameStateMessage(List<PlayerState> players, Set<String> claimedItemIds, LastEvent lastEvent,
            List<ZombieState> zombies, WaveState wave, List<DoorState> doors, LobbyState lobby, BossView boss,
            List<ProjectileState> projectiles, List<BarricadeState> barricades, MatchSummary summary,
            KinderEvent event, List<PuddleState> puddles) {
        this(players, claimedItemIds, lastEvent, zombies, wave, doors, lobby, boss, projectiles, barricades, summary,
                event, puddles, List.of(), true);
    }

    public static GameStateMessage eventOnly(LastEvent event) {
        return new GameStateMessage(List.of(), Set.of(), event, List.of(), null, List.of(), null, null, List.of(), List.of(),
                null, null, List.of());
    }
}
