package co.eci.operaciongaravito.game;

/**
 * Vista publica del Kinder en curso. {@code number} es el Kinder (0 antes del primero);
 * {@code remaining} son los kills que faltan para pasarlo; en el Kinder del jefe
 * ({@code bossStage}) no hay cuota.
 */
public record WaveState(
        int number,
        int total,
        int kills,
        int quota,
        int remaining,
        int restingSeconds,
        boolean bossStage,
        boolean victory,
        boolean waitingForMissions,
        int teamMissionsDone,
        int teamMissionsRequired) {

    /** La misma vista con el avance de misiones del equipo (lo lleva el MissionBoard). */
    public WaveState withMissions(int done, int required) {
        return new WaveState(number, total, kills, quota, remaining, restingSeconds, bossStage, victory,
                waitingForMissions, done, required);
    }
}
