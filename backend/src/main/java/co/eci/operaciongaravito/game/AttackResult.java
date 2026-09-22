package co.eci.operaciongaravito.game;

public record AttackResult(boolean success, String reason, int hits, int kills) {

    public static AttackResult rejected(String reason) {
        return new AttackResult(false, reason, 0, 0);
    }

    public static AttackResult ok(int hits, int kills) {
        return new AttackResult(true, null, hits, kills);
    }
}
