package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class MissionCatalog {

    public static final int REWARD_GARAVITOS = 25;

    // 3 salas por rol (una por piso), en espejo con frontend/src/game/missionCatalog.js.
    // Los 4 ids/coordenadas originales no cambiaron; el resto son instancias nuevas.
    public static final List<MissionZone> ZONES = List.of(
            // ECONOMIA
            new MissionZone("mission-economia", "ECONOMIA", 1, 1632, 1312, REWARD_GARAVITOS),
            new MissionZone("mission-economia-f2", "ECONOMIA", 2, 1568, 160, REWARD_GARAVITOS),
            new MissionZone("mission-economia-f3", "ECONOMIA", 3, 480, 1120, REWARD_GARAVITOS),

            // SEGURIDAD
            new MissionZone("mission-seguridad", "SEGURIDAD", 2, 1632, 1312, REWARD_GARAVITOS),
            new MissionZone("mission-seguridad-f1", "SEGURIDAD", 1, 288, 1376, REWARD_GARAVITOS),
            new MissionZone("mission-seguridad-f3", "SEGURIDAD", 3, 1760, 416, REWARD_GARAVITOS),

            // SALUD
            new MissionZone("mission-salud", "SALUD", 3, 736, 224, REWARD_GARAVITOS),
            new MissionZone("mission-salud-f1", "SALUD", 1, 352, 288, REWARD_GARAVITOS),
            new MissionZone("mission-salud-f2", "SALUD", 2, 608, 416, REWARD_GARAVITOS),

            // INFRAESTRUCTURA
            new MissionZone("mission-infraestructura", "INFRAESTRUCTURA", 3, 1632, 1312, REWARD_GARAVITOS),
            new MissionZone("mission-infraestructura-f1", "INFRAESTRUCTURA", 1, 1888, 160, REWARD_GARAVITOS),
            new MissionZone("mission-infraestructura-f2", "INFRAESTRUCTURA", 2, 800, 1376, REWARD_GARAVITOS)
    );

    private static final Map<String, MissionZone> BY_ID = ZONES.stream()
            .collect(Collectors.toMap(MissionZone::missionId, zone -> zone));

    private MissionCatalog() {
    }

    public static MissionZone byId(String missionId) {
        return BY_ID.get(missionId);
    }
}
