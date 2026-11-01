package co.eci.operaciongaravito.game;

/** {@code building}, {@code mode} y {@code temporada} solo cuentan al crear la sala. */
public record LobbyRequest(String clientId, boolean create, String building, String mode, String temporada) {
}
