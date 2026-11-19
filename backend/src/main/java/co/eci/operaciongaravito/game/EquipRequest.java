package co.eci.operaciongaravito.game;

/** {@code itemId} null o vacio = guardar el arma (puños). */
public record EquipRequest(String playerId, String itemId) {
}
