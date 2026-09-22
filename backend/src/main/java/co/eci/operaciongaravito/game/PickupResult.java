package co.eci.operaciongaravito.game;

public record PickupResult(boolean success, String reason) {

    public static PickupResult ok() {
        return new PickupResult(true, null);
    }

    public static PickupResult rejected(String reason) {
        return new PickupResult(false, reason);
    }
}
