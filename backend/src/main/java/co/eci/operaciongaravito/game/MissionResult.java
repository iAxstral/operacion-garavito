package co.eci.operaciongaravito.game;

/** Resultado de un intento de completar una mision. */
public record MissionResult(boolean success, String reason, int rewardGaravitos) {

    public static MissionResult ok(int rewardGaravitos) {
        return new MissionResult(true, null, rewardGaravitos);
    }

    public static MissionResult rejected(String reason) {
        return new MissionResult(false, reason, 0);
    }
}
