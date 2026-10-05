package co.eci.operaciongaravito.game;

/** {@code token}: secreto que genera el cliente para poder volver a su puesto si se desconecta. */
public record JoinRequest(String role, String clientId, String token) {
}
