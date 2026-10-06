package co.eci.operaciongaravito.game;

/**
 * {@code token}: secreto que genera el cliente para poder volver a su puesto si se desconecta.
 * {@code name}: apodo opcional que eligio el jugador. {@code costume}: disfraz puesto (cosmetico).
 */
public record JoinRequest(String role, String clientId, String token, String name, String costume) {
}
