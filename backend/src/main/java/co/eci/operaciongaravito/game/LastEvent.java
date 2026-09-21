package co.eci.operaciongaravito.game;

public record LastEvent(String type, String playerId, String itemId, String reason) {

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

    public static LastEvent useSuccess(String playerId, String itemId) {
        return new LastEvent("USE_SUCCESS", playerId, itemId, null);
    }

    public static LastEvent useRejected(String playerId, String itemId, String reason) {
        return new LastEvent("USE_REJECTED", playerId, itemId, reason);
    }
}
