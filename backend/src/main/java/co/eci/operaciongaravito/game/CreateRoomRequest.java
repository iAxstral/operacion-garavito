package co.eci.operaciongaravito.game;

/** Pedido de sala nueva (/app/game/create): el codigo lo genera el servidor. */
public record CreateRoomRequest(String clientId, String building, String mode) {
}
