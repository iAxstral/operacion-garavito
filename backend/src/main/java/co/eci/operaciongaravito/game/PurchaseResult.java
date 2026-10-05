package co.eci.operaciongaravito.game;

public record PurchaseResult(boolean success, String reason) {

    public static PurchaseResult ok() {
        return new PurchaseResult(true, null);
    }

    public static PurchaseResult rejected(String reason) {
        return new PurchaseResult(false, reason);
    }
}
