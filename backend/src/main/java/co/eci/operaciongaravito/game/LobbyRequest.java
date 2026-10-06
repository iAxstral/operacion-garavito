package co.eci.operaciongaravito.game;

/** {@code building} y {@code mode} solo cuentan al crear la sala. */
public record LobbyRequest(String clientId, boolean create, String building, String mode) {
}
