package co.eci.operaciongaravito.game;

/** Resultado de un intento de pickup. {@code reason} es null cuando success=true. */
public record PickupResult(boolean success, String reason) {

    public static PickupResult ok() {
        return new PickupResult(true, null);
    }

    public static PickupResult rejected(String reason) {
        return new PickupResult(false, reason);
    }
}
