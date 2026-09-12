package co.eci.operaciongaravito.game;

/** Resultado de un intento de compra. {@code reason} es null cuando success=true. */
public record PurchaseResult(boolean success, String reason) {

    public static PurchaseResult ok() {
        return new PurchaseResult(true, null);
    }

    public static PurchaseResult rejected(String reason) {
        return new PurchaseResult(false, reason);
    }
}
