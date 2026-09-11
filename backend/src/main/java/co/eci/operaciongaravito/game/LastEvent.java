package co.eci.operaciongaravito.game;

/**
 * Evento puntual que motivo este broadcast (join, pickup exitoso o
 * rechazado). Va en el mismo payload que {@code players} — todos los
 * clientes lo reciben, pero solo el jugador con playerId==el propio le
 * presta atencion (ej. mostrar "Inventario lleno"); el resto lo ignora.
 * {@code reason} es null en JOIN/PICKUP_SUCCESS.
 */
public record LastEvent(String type, String playerId, String itemId, String reason) {

    public static LastEvent joinOk(String playerId) {
        return new LastEvent("JOIN_OK", playerId, null, null);
    }

    public static LastEvent joinRejected(String reason) {
        return new LastEvent("JOIN_REJECTED", null, null, reason);
    }

    public static LastEvent pickupSuccess(String playerId, String itemId) {
        return new LastEvent("PICKUP_SUCCESS", playerId, itemId, null);
    }

    public static LastEvent pickupRejected(String playerId, String itemId, String reason) {
        return new LastEvent("PICKUP_REJECTED", playerId, itemId, reason);
    }
}
