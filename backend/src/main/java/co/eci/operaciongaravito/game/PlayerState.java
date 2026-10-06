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
        long chargedReadyInMs,
        Weapon weapon,
        int magazine,
        int reserveAmmo,
        long reloadingMs,
        int shotSeq,
        double shotFacing,
        String reviving,
        double reviveProgress,
        List<MissionView> missions,
        long abilityReadyInMs,
        boolean connected,
        String name,
        String hidingIn,
        long hiddenMs,
        int candies,
        String costume,
        boolean staticOmitted) {

    /** Copia sin lo que casi nunca cambia (el cliente conserva lo que ya tenia). */
    public PlayerState withoutStatic() {
        return new PlayerState(playerId, role, health, garavitos, null, floor, x, y, lifeState, invulnerable,
                chargedReadyInMs, weapon, magazine, reserveAmmo, reloadingMs, shotSeq, shotFacing, reviving,
                reviveProgress, null, abilityReadyInMs, connected, null, hidingIn, hiddenMs, candies, null, true);
    }
}
