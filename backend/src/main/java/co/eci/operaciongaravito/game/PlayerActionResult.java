package co.eci.operaciongaravito.game;

/** Resultado de una accion simple del jugador (equipar, recargar, revivir...). */
public record PlayerActionResult(boolean success, String reason) {

    public static PlayerActionResult ok() {
        return new PlayerActionResult(true, null);
    }

    public static PlayerActionResult rejected(String reason) {
        return new PlayerActionResult(false, reason);
    }
}
