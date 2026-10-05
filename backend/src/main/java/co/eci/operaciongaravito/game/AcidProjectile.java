package co.eci.operaciongaravito.game;

import java.util.Collection;

/**
 * Bola de acido del zombi escupidor. Viaja en linea recta y lenta (se esquiva
 * moviendose), se rompe contra paredes o puertas cerradas, y daña al primer jugador
 * vivo que toca.
 */
public class AcidProjectile {

    static final double SPEED_PX_S = 250;
    static final double HIT_RADIUS_PX = 22;
    static final int DAMAGE = 6;
    static final long LIFETIME_MS = 1_800;

    private final String id;
    private final int floor;
    private final double vx;
    private final double vy;
    private final long expiresAt;
    private double x;
    private double y;

    public AcidProjectile(String id, int floor, double x, double y, double angle, long now) {
        this.id = id;
        this.floor = floor;
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * SPEED_PX_S;
        this.vy = Math.sin(angle) * SPEED_PX_S;
        this.expiresAt = now + LIFETIME_MS;
    }

    public String getId() {
        return id;
    }

    public int getFloor() {
        return floor;
    }

    /**
     * Avanza la bola. Devuelve false cuando ya no existe: choco con una pared, con un
     * jugador (al que le hace dano) o se le acabo el tiempo.
     */
    public boolean step(FloorGrid grid, Collection<Player> players, double deltaSeconds, long now) {
        if (now >= expiresAt) {
            return false;
        }
        x += vx * deltaSeconds;
        y += vy * deltaSeconds;
        if (!grid.isWalkable(x, y)) {
            return false;
        }
        for (Player player : players) {
            if (player.isAlive() && player.getFloor() == floor
                    && Math.hypot(player.getX() - x, player.getY() - y) <= HIT_RADIUS_PX) {
                player.takeDamage(DAMAGE);
                return false;
            }
        }
        return true;
    }

    public ProjectileState toState() {
        return new ProjectileState(id, floor, Math.round(x), Math.round(y), Math.atan2(vy, vx));
    }
}
