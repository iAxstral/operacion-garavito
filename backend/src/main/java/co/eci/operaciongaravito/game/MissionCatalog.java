package co.eci.operaciongaravito.game;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Zonas de mision por edificio, en espejo con frontend/src/game/missionCatalog.js.
 * Las coordenadas de un edificio caen dentro de paredes del otro, asi que no se
 * comparten.
 */
public final class MissionCatalog {

    public static final int REWARD_GARAVITOS = 25;

    private static MissionZone zone(String id, String role, int floor, double x, double y) {
        return new MissionZone(id, role, floor, x, y, REWARD_GARAVITOS);
    }

    private static final Map<Building, List<MissionZone>> ZONES = new EnumMap<>(Map.of(
            // Edificio F: una mision por rol, como estaba antes del Edificio C.
            Building.F, List.of(
                    zone("mission-economia", "ECONOMIA", 1, 1632, 1312),
                    zone("mission-seguridad", "SEGURIDAD", 2, 1632, 1312),
                    zone("mission-salud", "SALUD", 3, 736, 224),
                    zone("mission-infraestructura", "INFRAESTRUCTURA", 3, 1632, 1312)),
            // Edificio C: 2 pisos, una sala por rol en cada piso.
            Building.C, List.of(
                    zone("mission-economia", "ECONOMIA", 1, 1632, 1312),
                    zone("mission-economia-f2", "ECONOMIA", 2, 1568, 160),
                    zone("mission-seguridad-f1", "SEGURIDAD", 1, 288, 1376),
                    zone("mission-seguridad", "SEGURIDAD", 2, 1632, 1312),
                    zone("mission-salud-f1", "SALUD", 1, 352, 288),
                    zone("mission-salud-f2", "SALUD", 2, 608, 416),
                    zone("mission-infraestructura-f1", "INFRAESTRUCTURA", 1, 1888, 160),
                    zone("mission-infraestructura-f2", "INFRAESTRUCTURA", 2, 800, 1376))));

    private static final Map<Building, Map<String, MissionZone>> BY_ID = indexById();

    private static Map<Building, Map<String, MissionZone>> indexById() {
        Map<Building, Map<String, MissionZone>> index = new EnumMap<>(Building.class);
        ZONES.forEach((building, zones) -> index.put(building,
                zones.stream().collect(Collectors.toMap(MissionZone::missionId, zone -> zone))));
        return index;
    }

    private MissionCatalog() {
    }

    public static List<MissionZone> zonesFor(Building building) {
        return ZONES.get(building);
    }

    public static MissionZone byId(Building building, String missionId) {
        return BY_ID.get(building).get(missionId);
    }
}
