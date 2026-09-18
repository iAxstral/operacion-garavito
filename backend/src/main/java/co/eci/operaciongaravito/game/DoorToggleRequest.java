package co.eci.operaciongaravito.game;

/** Pedido de abrir/cerrar una puerta. x/y es la posicion del jugador, para validar que este cerca. */
public record DoorToggleRequest(String playerId, String doorId, double x, double y) {
}
