package co.eci.operaciongaravito.game;

/** Posicion reportada por el cliente. Alta frecuencia: no dispara broadcast. */
public record MoveRequest(String playerId, double x, double y) {
}
