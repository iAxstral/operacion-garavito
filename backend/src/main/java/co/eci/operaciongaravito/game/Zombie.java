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

    /** Radio del cuerpo del zombi para chequear contra las paredes. */
    private static final double BODY_RADIUS = 12;

    /** Distancia a partir de la cual conviene ir derecho en vez de por celdas. */
    private static final double DIRECT_CHASE_PX = FloorGrid.TILE;

    /**
     * Mueve al zombi un paso. La llama solo el tick.
     *
     * @param distanceField campo de distancias hacia el objetivo (ver
     *                      {@link FloorGrid#distanceField}). Perseguir en linea
     *                      recta no alcanza dentro de un edificio: el zombi se
     *                      clava contra la pared que lo separa del jugador.
     */
    public void step(FloorGrid floor, int[][] distanceField, double targetX, double targetY,
                     double separationX, double separationY, double deltaSeconds, long now) {
        double moveX;
        double moveY;

        if (now < knockbackUntil) {
            moveX = knockbackVx * deltaSeconds;
            moveY = knockbackVy * deltaSeconds;
        } else {
            double distance = Math.hypot(targetX - x, targetY - y);
            double dirX;
            double dirY;

            if (distance <= DIRECT_CHASE_PX) {
                // Ya en la misma celda o pegado: ir derecho, que el campo a
                // esta escala solo produciria tironeos entre centros de celda.
                dirX = distance == 0 ? 0 : (targetX - x) / distance;
                dirY = distance == 0 ? 0 : (targetY - y) / distance;
            } else {
                double[] flow = floor.flowDirection(distanceField, x, y);
                // Sin ruta (el jugador quedo en otra zona sin conexion): se cae
                // a la persecucion directa para no dejar al zombi paralizado.
                boolean noRoute = flow[0] == 0 && flow[1] == 0;
                dirX = noRoute ? (targetX - x) / distance : flow[0];
                dirY = noRoute ? (targetY - y) / distance : flow[1];
            }

            moveX = dirX * speed * deltaSeconds + separationX * deltaSeconds;
            moveY = dirY * speed * deltaSeconds + separationY * deltaSeconds;
        }

        // Cada eje se resuelve por separado para que el zombi *deslice* a lo
        // largo de una pared en vez de quedarse clavado contra ella: si la
        // diagonal esta bloqueada, la componente que si es libre igual avanza.
        // Sin esto un zombi contra un muro se queda vibrando en el sitio.
        if (floor.fits(x + moveX, y, BODY_RADIUS)) {
            x += moveX;
        }
        if (floor.fits(x, y + moveY, BODY_RADIUS)) {
            y += moveY;
        }
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
