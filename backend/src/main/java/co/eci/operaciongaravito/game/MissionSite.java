package co.eci.operaciongaravito.game;

/** Sala donde puede tocar una mision: un punto libre de muebles cerca del centro. */
public record MissionSite(String siteId, String room, int floor, double x, double y) {
}
