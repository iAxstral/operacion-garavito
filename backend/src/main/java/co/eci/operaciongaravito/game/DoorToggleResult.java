package co.eci.operaciongaravito.game;

/** Resultado de un intento de abrir/cerrar una puerta. */
public record DoorToggleResult(boolean success, String reason, boolean open) {

    public static DoorToggleResult ok(boolean open) {
        return new DoorToggleResult(true, null, open);
    }

    public static DoorToggleResult rejected(String reason) {
        return new DoorToggleResult(false, reason, false);
    }
}
