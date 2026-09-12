package co.eci.operaciongaravito.game;

/** Golpe pedido por el cliente. {@code facing} en radianes. */
public record AttackRequest(String playerId, double x, double y, double facing) {
}
