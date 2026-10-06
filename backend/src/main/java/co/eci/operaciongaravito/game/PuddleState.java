package co.eci.operaciongaravito.game;

/** Un charco de acido tal como viaja al cliente. */
public record PuddleState(String id, int floor, long x, long y, long remainingMs) {
}
