package co.eci.operaciongaravito.game;

public record AttackRequest(String playerId, AttackType type, double x, double y, double facing) {
}
