package co.eci.operaciongaravito.game;

/**
 * Un zombi dentro de una {@link GameSession}.
 *
 * Concurrencia: la posicion la escribe solo el hilo del tick, mientras que el
 * daño puede llegar desde un hilo de Tomcat (un /attack). Por eso {@link #hit}
 * es synchronized y devuelve si ESTE golpe fue el que lo mato — dos golpes
 * casi simultaneos de dos jugadores no pueden cobrar ambos la recompensa. Los
 * campos que el tick escribe y el broadcast lee son volatile.
 */
public class Zombie {

    private static final int CONTACT_DAMAGE = 10;
    private static final long CONTACT_COOLDOWN_MS = 600;

    private final String id;
    private final double speed;
    private final boolean tough;

    private volatile double x;
    private volatile double y;
    private volatile int health;
    private volatile long nextContactAt;
    /** Hasta cuando este zombi va empujado y no persigue. */
    private volatile long knockbackUntil;
    private volatile double knockbackVx;
    private volatile double knockbackVy;

    public Zombie(String id, double x, double y, int health, double speed) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.health = health;
        this.speed = speed;
        this.tough = health >= WaveCurve.ZOMBIE_TOUGH_HEALTH;
    }

    public String getId() {
        return id;
    }

    public double getX() {
        return x;
    }

    public double getY() {
        return y;
    }

    public boolean isAlive() {
        return health > 0;
    }

    public boolean isTough() {
        return tough;
    }

    /**
     * Aplica daño. Devuelve true solo si este golpe lo mato, para que la
     * recompensa en Garavitos se pague exactamente una vez.
     */
    public synchronized boolean hit(int damage, double knockbackVx, double knockbackVy, long now) {
        if (health <= 0) {
            return false;
        }
        health -= damage;
        this.knockbackVx = knockbackVx;
        this.knockbackVy = knockbackVy;
        this.knockbackUntil = now + 180;
        return health <= 0;
    }

    /** Mueve al zombi un paso hacia el objetivo. La llama solo el tick. */
    public void step(double targetX, double targetY, double separationX, double separationY,
                     double deltaSeconds, long now) {
        if (now < knockbackUntil) {
            x += knockbackVx * deltaSeconds;
            y += knockbackVy * deltaSeconds;
            return;
        }

        double dx = targetX - x;
        double dy = targetY - y;
        double distance = Math.hypot(dx, dy);
        if (distance > 1) {
            x += (dx / distance) * speed * deltaSeconds;
            y += (dy / distance) * speed * deltaSeconds;
        }
        x += separationX * deltaSeconds;
        y += separationY * deltaSeconds;
    }

    /**
     * Intenta morder al jugador. El cooldown es por zombi: cuatro zombis
     * encima pegan cuatro veces, uno solo no pega cuatro veces mas rapido.
     */
    public boolean tryBite(Player player, long now) {
        if (!isAlive() || now < nextContactAt) {
            return false;
        }
        nextContactAt = now + CONTACT_COOLDOWN_MS;
        return player.takeDamage(CONTACT_DAMAGE);
    }

    public ZombieState toState() {
        return new ZombieState(id, Math.round(x), Math.round(y), health, tough);
    }
}
