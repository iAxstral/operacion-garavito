package co.eci.operaciongaravito.game;

/** Vista publica de una puerta, tal como se manda en el broadcast. */
public record DoorState(String doorId, boolean open) {
}
