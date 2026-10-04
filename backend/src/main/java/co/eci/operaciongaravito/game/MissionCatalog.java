package co.eci.operaciongaravito.game;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Salas donde pueden tocar misiones, por edificio (espejo de
 * frontend/src/game/missionCatalog.js). Cada punto es una celda libre de muebles cerca
 * del centro de la sala, calculada desde los layouts del cliente.
 */
public final class MissionCatalog {

    /** Lo que paga una mision en el Kinder 1; despues sube 5 por Kinder. */
    public static final int REWARD_GARAVITOS = 25;

    public static int rewardFor(int kinder) {
        return REWARD_GARAVITOS + 5 * Math.max(0, kinder - 1);
    }

    private static MissionSite site(String id, String room, int floor, double x, double y) {
        return new MissionSite(id, room, floor, x, y);
    }

    private static final Map<Building, List<MissionSite>> SITES = new EnumMap<>(Map.of(
            Building.F, List.of(
                    site("f1-aula-f-104", "Aula F-104", 1, 608, 288),
                    site("f1-sala-de-profesores", "Sala de Profesores", 1, 1760, 288),
                    site("f1-terraza", "Terraza", 1, 608, 1248),
                    site("f1-cafeteria", "Cafetería", 1, 1760, 1248),
                    site("f2-biblioteca", "Biblioteca", 2, 608, 288),
                    site("f2-sala-de-reuniones", "Sala de Reuniones", 2, 1888, 288),
                    site("f2-sala-de-estudio", "Sala de Estudio", 2, 608, 1248),
                    site("f2-armero", "Armero", 2, 1760, 1248),
                    site("f3-laboratorio-biomedico", "Laboratorio Biomédico", 3, 608, 288),
                    site("f3-sala-de-servidores", "Sala de Servidores", 3, 1760, 288),
                    site("f3-auditorio", "Auditorio", 3, 608, 1248),
                    site("f3-sala-de-maquinas", "Sala de Máquinas", 3, 1760, 1248)),
            Building.C, List.of(
                    site("c1-sala-de-estudio", "Sala de Estudio", 1, 416, 288),
                    site("c1-deposito-de-servicio", "Depósito de Servicio", 1, 1760, 288),
                    site("c1-terraza", "Terraza", 1, 416, 1248),
                    site("c1-cafeteria", "Cafetería", 1, 1760, 1248),
                    site("c2-biblioteca", "Biblioteca", 2, 608, 288),
                    site("c2-sala-de-reuniones", "Sala de Reuniones", 2, 1888, 288),
                    site("c2-sala-de-estudio", "Sala de Estudio", 2, 608, 1248),
                    site("c2-armero", "Armero", 2, 1760, 1248))));

    private MissionCatalog() {
    }

    public static List<MissionSite> sitesFor(Building building) {
        return SITES.get(building);
    }
}
