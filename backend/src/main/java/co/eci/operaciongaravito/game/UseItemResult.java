package co.eci.operaciongaravito.game;

public record UseItemResult(boolean success, String reason) {

    public static UseItemResult ok() {
        return new UseItemResult(true, null);
    }

    public static UseItemResult rejected(String reason) {
        return new UseItemResult(false, reason);
    }
}
