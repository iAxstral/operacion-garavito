package co.eci.operaciongaravito.game;

public class Zombie {

    private static final int CONTACT_DAMAGE = 2;
    private static final long CONTACT_COOLDOWN_MS = 600;

    private final String id;
    private final int floor;
    private final double speed;
    private final boolean tough;

    private volatile double x;
    private volatile double y;
    private volatile int health;
    private volatile long nextContactAt;

    private volatile long knockbackUntil;
    private volatile double knockbackVx;
    private volatile double knockbackVy;

    public Zombie(String id, int floor, double x, double y, int health, double speed) {
        this.id = id;
        this.floor = floor;
        this.x = x;
        this.y = y;
        this.health = health;
        this.speed = speed;
        this.tough = health >= WaveCurve.ZOMBIE_TOUGH_HEALTH;
    }

    public String getId() {
        return id;
    }

    public int getFloor() {
        return floor;
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

    private static final double BODY_RADIUS = 12;

    private static final double DIRECT_CHASE_PX = FloorGrid.TILE;

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

                dirX = distance == 0 ? 0 : (targetX - x) / distance;
                dirY = distance == 0 ? 0 : (targetY - y) / distance;
            } else {
                double[] flow = floor.flowDirection(distanceField, x, y);

                boolean noRoute = flow[0] == 0 && flow[1] == 0;
                dirX = noRoute ? (targetX - x) / distance : flow[0];
                dirY = noRoute ? (targetY - y) / distance : flow[1];
            }

            moveX = dirX * speed * deltaSeconds + separationX * deltaSeconds;
            moveY = dirY * speed * deltaSeconds + separationY * deltaSeconds;
        }

        if (floor.fits(x + moveX, y, BODY_RADIUS)) {
            x += moveX;
        }
        if (floor.fits(x, y + moveY, BODY_RADIUS)) {
            y += moveY;
        }
    }

    public boolean tryBite(Player player, long now) {
        if (!isAlive() || now < nextContactAt) {
            return false;
        }
        nextContactAt = now + CONTACT_COOLDOWN_MS;
        return player.takeDamage(CONTACT_DAMAGE);
    }

    public ZombieState toState() {
        return new ZombieState(id, floor, Math.round(x), Math.round(y), health, tough);
    }
}
