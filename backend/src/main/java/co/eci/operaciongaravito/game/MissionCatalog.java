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
                    site("c2-armero", "Armero", 2, 1760, 1248)),
            Building.G, List.of(
                    site("g1-sala-de-computo", "Sala de Cómputo", 1, 608, 288),
                    site("g1-laboratorio-de-suelos", "Laboratorio de Suelos", 1, 1760, 288),
                    site("g1-taller-de-modelos", "Taller de Modelos", 1, 608, 1248),
                    site("g1-cafeteria", "Cafetería", 1, 1760, 1248),
                    site("g2-laboratorio-de-hidraulica", "Laboratorio de Hidráulica", 2, 608, 288),
                    site("g2-sala-de-proyectos", "Sala de Proyectos", 2, 1888, 288),
                    site("g2-archivo-de-planos", "Archivo de Planos", 2, 608, 1248),
                    site("g2-armeria", "Armería", 2, 1760, 1248)),
            Building.A, List.of(
                    site("a1-registro-academico", "Registro Académico", 1, 608, 288),
                    site("a1-tesoreria", "Tesorería", 1, 1760, 288),
                    site("a1-bienestar-universitario", "Bienestar Universitario", 1, 608, 1248),
                    site("a1-cafeteria", "Cafetería", 1, 1760, 1248),
                    site("a2-decanatura", "Decanatura", 2, 608, 288),
                    site("a2-sala-de-consejo", "Sala de Consejo", 2, 1888, 288),
                    site("a2-archivo-central", "Archivo Central", 2, 608, 1248),
                    site("a2-armeria", "Armería", 2, 1760, 1248),
                    site("a3-rectoria", "Rectoría", 3, 608, 288),
                    site("a3-centro-de-datos", "Centro de Datos", 3, 1760, 288),
                    site("a3-auditorio-principal", "Auditorio Principal", 3, 608, 1248),
                    site("a3-sala-de-prensa", "Sala de Prensa", 3, 1760, 1248)),
            Building.B, List.of(
                    site("b1-laboratorio-de-fisica", "Laboratorio de Física", 1, 608, 288),
                    site("b1-laboratorio-de-quimica", "Laboratorio de Química", 1, 1760, 288),
                    site("b1-aula-101", "Aula 101", 1, 608, 1248),
                    site("b1-cafeteria", "Cafetería", 1, 1760, 1248),
                    site("b2-laboratorio-de-biologia", "Laboratorio de Biología", 2, 608, 288),
                    site("b2-sala-de-matematicas", "Sala de Matemáticas", 2, 1888, 288),
                    site("b2-salon-de-profesores", "Salón de Profesores", 2, 608, 1248),
                    site("b2-armeria", "Armería", 2, 1760, 1248),
                    site("b3-observatorio", "Observatorio", 3, 608, 288),
                    site("b3-laboratorio-de-electronica", "Laboratorio de Electrónica", 3, 1760, 288),
                    site("b3-deposito-de-reactivos", "Depósito de Reactivos", 3, 608, 1248),
                    site("b3-sala-de-tutorias", "Sala de Tutorías", 3, 1760, 1248)),
            Building.BIBLIOTECA, List.of(
                    site("bib1-prestamo-y-devolucion", "Préstamo y Devolución", 1, 608, 288),
                    site("bib1-hemeroteca", "Hemeroteca", 1, 1760, 288),
                    site("bib1-sala-de-lectura", "Sala de Lectura", 1, 608, 1248),
                    site("bib1-cafeteria", "Cafetería", 1, 1760, 1248),
                    site("bib2-colecciones-especiales", "Colecciones Especiales", 2, 608, 288),
                    site("bib2-sala-de-estudio-grupal", "Sala de Estudio Grupal", 2, 1888, 288),
                    site("bib2-archivo-historico", "Archivo Histórico", 2, 608, 1248),
                    site("bib2-armeria", "Armería", 2, 1760, 1248))));

    private MissionCatalog() {
    }

    public static List<MissionSite> sitesFor(Building building) {
        return SITES.get(building);
    }
}
