package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Armarios donde un jugador puede esconderse un momento. Hay uno en la mitad de las
 * salas con mision de cada edificio, en la primera celda libre a dos baldosas del
 * centro de la sala (asi no tapa la mision). Es fijo por edificio: el cliente los
 * pide por REST y los dibuja; aqui se valida quien entra.
 */
public final class HideSpots {

    /** Un armario: identificador, piso y centro en pixeles del mundo. */
    public record Spot(String id, int floor, double x, double y) {
    }

    /** Distancia maxima (px) entre el jugador y el armario para entrar. */
    public static final double REACH_PX = 80;

    private static final int[][] OFFSETS = { { 2, 0 }, { -2, 0 }, { 0, 2 }, { 0, -2 }, { 2, 2 }, { -2, 2 } };
    private static final Map<Building, List<Spot>> CACHE = new EnumMap<>(Building.class);

    private HideSpots() {
    }

    public static synchronized List<Spot> forBuilding(Building building) {
        return CACHE.computeIfAbsent(building, HideSpots::compute);
    }

    private static List<Spot> compute(Building building) {
        List<Spot> spots = new ArrayList<>();
        List<MissionSite> sites = MissionCatalog.sitesFor(building);
        for (int i = 0; i < sites.size(); i += 2) {
            MissionSite site = sites.get(i);
            FloorGrid grid = FloorGrid.forFloor(building, site.floor());
            for (int[] offset : OFFSETS) {
                double x = site.x() + offset[0] * FloorGrid.TILE;
                double y = site.y() + offset[1] * FloorGrid.TILE;
                if (grid.isWalkable(x, y)) {
                    spots.add(new Spot("h-" + site.siteId(), site.floor(), x, y));
                    break;
                }
            }
        }
        return List.copyOf(spots);
    }

    /** El armario libre mas cercano al jugador dentro de su alcance, o null. */
    public static Spot near(Building building, int floor, double x, double y) {
        Spot best = null;
        double bestDistance = REACH_PX;
        for (Spot spot : forBuilding(building)) {
            double distance = Math.hypot(spot.x() - x, spot.y() - y);
            if (spot.floor() == floor && distance <= bestDistance) {
                best = spot;
                bestDistance = distance;
            }
        }
        return best;
    }
}
