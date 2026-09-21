package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class MissionCatalog {

    public static final int REWARD_GARAVITOS = 25;

    public static final List<MissionZone> ZONES = List.of(
            new MissionZone("mission-economia", "ECONOMIA", 1, 1632, 1312, REWARD_GARAVITOS),
            new MissionZone("mission-seguridad", "SEGURIDAD", 2, 1632, 1312, REWARD_GARAVITOS),
            new MissionZone("mission-salud", "SALUD", 3, 736, 224, REWARD_GARAVITOS),
            new MissionZone("mission-infraestructura", "INFRAESTRUCTURA", 3, 1632, 1312, REWARD_GARAVITOS)
    );

    private static final Map<String, MissionZone> BY_ID = ZONES.stream()
            .collect(Collectors.toMap(MissionZone::missionId, zone -> zone));

    private MissionCatalog() {
    }

    public static MissionZone byId(String missionId) {
        return BY_ID.get(missionId);
    }
}
