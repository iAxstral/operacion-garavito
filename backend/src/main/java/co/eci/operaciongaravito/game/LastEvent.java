package co.eci.operaciongaravito.game;

/**
 * Evento puntual que motivo este broadcast (join, pickup exitoso o
 * rechazado). Va en el mismo payload que {@code players} — todos los
 * clientes lo reciben, pero solo el jugador con playerId==el propio le
 * presta atencion (ej. mostrar "Inventario lleno"); el resto lo ignora.
 * {@code reason} es null en JOIN/PICKUP_SUCCESS.
 */
public record LastEvent(String type, String playerId, String itemId, String reason) {

    /** Cayo el equipo completo: se perdio la corrida y se vuelve a la oleada 1. */
    public static LastEvent teamWiped() {
        return new LastEvent("TEAM_WIPED", null, null, null);
    }

    /** El itemId lleva cuantos zombis cayeron con ese golpe. */
    public static LastEvent attackKill(String playerId, int kills) {
        return new LastEvent("ATTACK_KILL", playerId, String.valueOf(kills), null);
    }

    public static LastEvent attackRejected(String playerId, String reason) {
        return new LastEvent("ATTACK_REJECTED", playerId, null, reason);
    }

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

    public static LastEvent purchaseSuccess(String playerId, String itemId) {
        return new LastEvent("PURCHASE_SUCCESS", playerId, itemId, null);
    }

    public static LastEvent purchaseRejected(String playerId, String itemId, String reason) {
        return new LastEvent("PURCHASE_REJECTED", playerId, itemId, reason);
    }

    // itemId se reutiliza como missionId aca — mismo shape generico, sin
    // agregar un campo nuevo solo para misiones.
    public static LastEvent missionSuccess(String playerId, String missionId) {
        return new LastEvent("MISSION_SUCCESS", playerId, missionId, null);
    }

    public static LastEvent missionRejected(String playerId, String missionId, String reason) {
        return new LastEvent("MISSION_REJECTED", playerId, missionId, reason);
    }
}
