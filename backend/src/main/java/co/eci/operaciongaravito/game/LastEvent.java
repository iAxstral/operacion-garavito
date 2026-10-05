package co.eci.operaciongaravito.game;

public record LastEvent(String type, String playerId, String itemId, String reason) {

    /** El equipo gano el ultimo Kinder del edificio. */
    public static LastEvent victory() {
        return new LastEvent("VICTORY", null, null, null);
    }

    public static LastEvent teamWiped() {
        return new LastEvent("TEAM_WIPED", null, null, null);
    }

    public static LastEvent attackKill(String playerId, int kills) {
        return new LastEvent("ATTACK_KILL", playerId, String.valueOf(kills), null);
    }

    public static LastEvent attackRejected(String playerId, String reason) {
        return new LastEvent("ATTACK_REJECTED", playerId, null, reason);
    }

    public static LastEvent joinOk(String playerId, String clientId) {
        return new LastEvent("JOIN_OK", playerId, clientId, null);
    }

    public static LastEvent joinRejected(String clientId, String reason) {
        return new LastEvent("JOIN_REJECTED", clientId, null, reason);
    }

    public static LastEvent rejoinOk(String playerId, String clientId) {
        return new LastEvent("REJOIN_OK", playerId, clientId, null);
    }

    public static LastEvent rejoinRejected(String clientId, String reason) {
        return new LastEvent("REJOIN_REJECTED", clientId, null, reason);
    }

    public static LastEvent lobbyOk(String clientId) {
        return new LastEvent("LOBBY_OK", clientId, null, null);
    }

    public static LastEvent lobbyRejected(String clientId, String reason) {
        return new LastEvent("LOBBY_REJECTED", clientId, null, reason);
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

    public static LastEvent missionSuccess(String playerId, String missionId) {
        return new LastEvent("MISSION_SUCCESS", playerId, missionId, null);
    }

    public static LastEvent missionRejected(String playerId, String missionId, String reason) {
        return new LastEvent("MISSION_REJECTED", playerId, missionId, reason);
    }

    public static LastEvent missionStarted(String playerId, String missionId) {
        return new LastEvent("MISSION_STARTED", playerId, missionId, null);
    }

    public static LastEvent missionCancelled(String playerId, String missionId) {
        return new LastEvent("MISSION_CANCELLED", playerId, missionId, null);
    }

    public static LastEvent doorRejected(String playerId, String doorId, String reason) {
        return new LastEvent("DOOR_REJECTED", playerId, doorId, reason);
    }

    public static LastEvent equipRejected(String playerId, String itemId, String reason) {
        return new LastEvent("EQUIP_REJECTED", playerId, itemId, reason);
    }

    public static LastEvent reloadRejected(String playerId, String reason) {
        return new LastEvent("RELOAD_REJECTED", playerId, null, reason);
    }

    /** {@code playerId} volvio a la partida gracias a {@code itemId} (quien lo revivio). */
    public static LastEvent revived(String revivedId, String reviverId) {
        return new LastEvent("REVIVED", revivedId, reviverId, null);
    }

    public static LastEvent reviveRejected(String playerId, String targetId, String reason) {
        return new LastEvent("REVIVE_REJECTED", playerId, targetId, reason);
    }

    /** {@code playerId} le envio {@code reason} Garavitos a {@code itemId}. */
    public static LastEvent transfer(String fromId, String toId, int amount) {
        return new LastEvent("TRANSFER", fromId, toId, String.valueOf(amount));
    }

    public static LastEvent abilityRejected(String playerId, String reason) {
        return new LastEvent("ABILITY_REJECTED", playerId, null, reason);
    }

    public static LastEvent useSuccess(String playerId, String itemId) {
        return new LastEvent("USE_SUCCESS", playerId, itemId, null);
    }

    public static LastEvent useRejected(String playerId, String itemId, String reason) {
        return new LastEvent("USE_REJECTED", playerId, itemId, reason);
    }
}
