package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Set;

/**
 * Payload unico que se difunde por /topic/game/{gameId}, para join, pickup,
 * ronda y el tick de zombis. Un solo canal por partida, nunca uno separado
 * por tipo de evento.
 */
public record GameStateMessage(
        List<PlayerState> players,
        Set<String> claimedItemIds,
        LastEvent lastEvent,
        RoundState round,
        List<ZombieState> zombies,
        WaveState wave,
        List<DoorState> doors) {
}
