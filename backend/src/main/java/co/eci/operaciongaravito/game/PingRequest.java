package co.eci.operaciongaravito.game;

/** {@code kind}: ZOMBIES, HELP, REVIVE, GO o AMMO (ver {@link GameSession#attemptPing}). */
public record PingRequest(String playerId, String kind) {
}
