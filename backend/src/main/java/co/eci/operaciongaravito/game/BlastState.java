package co.eci.operaciongaravito.game;

/** Una explosion de zombi explosivo tal como viaja al cliente (se ve medio segundo). */
public record BlastState(String id, int floor, long x, long y, long bornAt) {
}
