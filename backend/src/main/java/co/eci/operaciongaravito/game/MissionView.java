package co.eci.operaciongaravito.game;

/** Una mision asignada a un jugador, tal como viaja al cliente. */
public record MissionView(String missionId, MissionType type, String siteId, String room, int floor,
                          long x, long y, int reward, boolean done) {
}
