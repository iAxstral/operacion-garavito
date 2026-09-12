package co.eci.operaciongaravito.game;

/**
 * Resultado de un golpe. {@code kills} alimenta la recompensa en Garavitos;
 * {@code hits} solo sirve para que el cliente decida el feedback visual.
 */
public record AttackResult(boolean success, String reason, int hits, int kills) {

    public static AttackResult rejected(String reason) {
        return new AttackResult(false, reason, 0, 0);
    }

    public static AttackResult ok(int hits, int kills) {
        return new AttackResult(true, null, hits, kills);
    }
}
