package co.eci.operaciongaravito.game;

import java.util.List;

public record PlayerState(
        String playerId,
        String role,
        int health,
        int garavitos,
        List<InventorySlot> inventory,
        int floor,
        long x,
        long y,
        PlayerLifeState lifeState,
        boolean invulnerable,
        long chargedReadyInMs) {
}
