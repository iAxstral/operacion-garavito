package co.eci.operaciongaravito.game;

/**
 * Zona de mision placeholder: una por rol (para que no compitan por la
 * misma), se completa automaticamente al pisarla (mismo patron que el
 * pickup de comida — caminar sobre la zona, sin tecla). Posicion en
 * pixeles, debe coincidir con frontend/src/game/missionCatalog.js.
 */
public record MissionZone(String missionId, String role, double x, double y, int rewardGaravitos) {
}
