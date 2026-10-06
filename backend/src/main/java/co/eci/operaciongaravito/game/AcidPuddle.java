package co.eci.operaciongaravito.game;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

/**
 * Charco de acido que deja el zombi escupidor al morir. Durante unos segundos daña de
 * a poco a los jugadores que se paran encima (cada uno con su propio ritmo de daño,
 * asi pisarlo un instante no cuesta lo mismo que quedarse).
 */
public class AcidPuddle {

    static final double RADIUS_PX = 36;
    static final int DAMAGE = 2;
    static final long HURT_EVERY_MS = 600;
    static final long LIFETIME_MS = 5_000;

    private final String id;
    private final int floor;
    private final double x;
    private final double y;
    private final long expiresAt;
    private final Map<String, Long> nextHurtAt = new HashMap<>();

    public AcidPuddle(String id, int floor, double x, double y, long now) {
        this.id = id;
        this.floor = floor;
        this.x = x;
        this.y = y;
        this.expiresAt = now + LIFETIME_MS;
    }

    /** Daña a quien este encima. Devuelve false cuando el charco ya se seco. */
    public boolean step(Collection<Player> players, long now) {
        if (now >= expiresAt) {
            return false;
        }
        for (Player player : players) {
            if (!player.isAlive() || player.getFloor() != floor
                    || Math.hypot(player.getX() - x, player.getY() - y) > RADIUS_PX) {
                continue;
            }
            long due = nextHurtAt.getOrDefault(player.getPlayerId(), 0L);
            if (now >= due) {
                player.takeDamage(DAMAGE);
                nextHurtAt.put(player.getPlayerId(), now + HURT_EVERY_MS);
            }
        }
        return true;
    }

    public PuddleState toState(long now) {
        return new PuddleState(id, floor, Math.round(x), Math.round(y), Math.max(0, expiresAt - now));
    }
}
