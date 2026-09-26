package co.eci.operaciongaravito.game;

/** {@code building} solo cuenta al crear la sala; al unirse manda el de la sala. */
public record LobbyRequest(String clientId, boolean create, String building) {
}
