package co.eci.operaciongaravito.game;

import java.util.List;

/** Vista publica de un Player, tal como se manda en el broadcast. */
public record PlayerState(String playerId, String role, int health, int garavitos, List<InventorySlot> inventory) {
}
