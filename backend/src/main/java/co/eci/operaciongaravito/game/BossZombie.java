package co.eci.operaciongaravito.game;

import java.util.List;
import java.util.random.RandomGenerator;

/**
 * Jefe "Ingeniero de Sistemas": aparece en el Kinder 5 y caza a los jugadores de su piso.
 *
 * Maquina de estados ({@link BossState}), segun el jugador vivo mas cercano de su piso:
 * <ul>
 *   <li>PATRULLA: recorre por A* puntos caminables cerca del jugador mas cercano (ronda
 *       cazando, aunque no lo vea). Si lo ve a menos de {@code detectionRadius} y con
 *       linea de vision → ALERTA.</li>
 *   <li>ALERTA: se planta {@code alertMs} y se lanza → PERSECUCION.</li>
 *   <li>PERSECUCION: recalcula el camino cada {@code repathMs} (no en cada tick) hacia el
 *       jugador, o hacia donde lo vio por ultima vez: doblar una esquina no lo despista.
 *       A {@code attackRadius} → ATAQUE; sin ver a nadie por {@code loseTargetMs} → PATRULLA.</li>
 *   <li>ATAQUE: muerde con cooldown; si el jugador se aleja → PERSECUCION.</li>
 *   <li>ATURDIDO: tras un golpe cargado, quieto {@code stunMs}; luego → PERSECUCION.</li>
 * </ul>
 *
 * Concurrencia: {@link #update} lo llama el hilo del tick y {@link #hit} los hilos de
 * Tomcat (/attack); ambos se serializan con el monitor de esta instancia.
 */
public class BossZombie {

    public static final String NAME = "Ingeniero de Sistemas";

    /** Radio del cuerpo contra las paredes: mas grande que un zombi pero cabe por una puerta. */
    private static final double BODY_RADIUS = 18;
    /** Holgura para salir de ATAQUE, asi no parpadea entre ATAQUE y PERSECUCION en el borde. */
    private static final double ATTACK_EXIT_FACTOR = 1.3;
    private static final int PATROL_RADIUS_TILES = 6;

    private final String id;
    private final BossConfig config;
    private final RandomGenerator random;

    private int floor;
    private double x;
    private double y;
    private int health;
    private BossState state = BossState.PATRULLA;

    private long stateUntil;
    private long lastSeenAt = Long.MIN_VALUE;
    private double lastSeenX;
    private double lastSeenY;
    private long nextRepathAt;
    private long nextBiteAt;
    private List<int[]> path = List.of();
    private int pathIndex;
    private int pathComputations;

    public BossZombie(String id, int floor, double x, double y, BossConfig config, RandomGenerator random) {
        this.id = id;
        this.floor = floor;
        this.x = x;
        this.y = y;
        this.config = config;
        this.random = random;
        this.health = config.maxHealth();
    }

    public synchronized void update(long now, double deltaSeconds, FloorGrid grid, List<Player> playersOnFloor) {
        if (!isAlive()) {
            return;
        }
        Player target = nearest(playersOnFloor);
        double distance = target == null ? Double.MAX_VALUE : Math.hypot(target.getX() - x, target.getY() - y);
        boolean sees = target != null
                && distance <= config.detectionRadiusPx()
                && grid.hasLineOfSight(x, y, target.getX(), target.getY());
        if (sees) {
            lastSeenAt = now;
            lastSeenX = target.getX();
            lastSeenY = target.getY();
        }

        switch (state) {
            case ATURDIDO -> {
                if (now >= stateUntil) {
                    enter(recentlySeen(now) ? BossState.PERSECUCION : BossState.PATRULLA, now);
                }
            }
            case PATRULLA -> {
                if (sees) {
                    enter(BossState.ALERTA, now);
                    stateUntil = now + config.alertMs();
                } else {
                    patrol(now, deltaSeconds, grid, target);
                }
            }
            case ALERTA -> {
                if (now >= stateUntil) {
                    enter(recentlySeen(now) ? BossState.PERSECUCION : BossState.PATRULLA, now);
                }
            }
            case PERSECUCION -> {
                if (target != null && distance <= config.attackRadiusPx()) {
                    enter(BossState.ATAQUE, now);
                } else if (!recentlySeen(now)) {
                    enter(BossState.PATRULLA, now);
                } else {
                    chase(now, deltaSeconds, grid, sees ? target.getX() : lastSeenX, sees ? target.getY() : lastSeenY);
                }
            }
            case ATAQUE -> {
                if (target == null || distance > config.attackRadiusPx() * ATTACK_EXIT_FACTOR) {
                    enter(BossState.PERSECUCION, now);
                } else if (now >= nextBiteAt) {
                    nextBiteAt = now + config.attackCooldownMs();
                    target.takeDamage(config.biteDamage());
                }
            }
        }
    }

    /**
     * Daño de un golpe. Un golpe cargado lo aturde. Devuelve true solo si ESTE golpe lo
     * mato, para que la victoria y la recompensa se cobren una sola vez.
     */
    public synchronized boolean hit(int damage, boolean charged, long now) {
        if (!isAlive()) {
            return false;
        }
        health = Math.max(0, health - damage);
        if (health == 0) {
            return true;
        }
        if (charged) {
            enter(BossState.ATURDIDO, now);
            stateUntil = now + config.stunMs();
        }
        return false;
    }

    /** Lo lleva a otro piso (por la escalera) cuando se quedo solo en el suyo. */
    public synchronized void relocate(int newFloor, double newX, double newY, long now) {
        floor = newFloor;
        x = newX;
        y = newY;
        path = List.of();
        lastSeenAt = Long.MIN_VALUE;
        enter(BossState.PATRULLA, now);
    }

    private boolean recentlySeen(long now) {
        return lastSeenAt != Long.MIN_VALUE && now - lastSeenAt <= config.loseTargetMs();
    }

    private void enter(BossState next, long now) {
        if (state != next) {
            state = next;
            path = List.of();
            nextRepathAt = now;
        }
    }

    private void chase(long now, double deltaSeconds, FloorGrid grid, double goalX, double goalY) {
        if (now >= nextRepathAt || pathIndex >= path.size()) {
            repath(grid, goalX, goalY);
            nextRepathAt = now + config.repathMs();
        }
        followPath(deltaSeconds, grid);
    }

    private void patrol(long now, double deltaSeconds, FloorGrid grid, Player nearest) {
        if (pathIndex >= path.size()) {
            int[] waypoint = patrolWaypoint(grid, nearest);
            if (waypoint != null) {
                computePath(grid, waypoint);
            }
            nextRepathAt = now + config.repathMs();
        }
        followPath(deltaSeconds, grid);
    }

    /** Una celda caminable al azar cerca del jugador mas cercano (o cerca del jefe si no hay nadie). */
    private int[] patrolWaypoint(FloorGrid grid, Player nearest) {
        boolean[][] walkable = grid.walkableSnapshot();
        int[] center = nearest != null ? FloorGrid.cellOf(nearest.getX(), nearest.getY()) : FloorGrid.cellOf(x, y);
        for (int attempt = 0; attempt < 30; attempt++) {
            int col = center[0] + random.nextInt(-PATROL_RADIUS_TILES, PATROL_RADIUS_TILES + 1);
            int row = center[1] + random.nextInt(-PATROL_RADIUS_TILES, PATROL_RADIUS_TILES + 1);
            if (row >= 0 && row < walkable.length && col >= 0 && col < walkable[row].length && walkable[row][col]) {
                return new int[] { col, row };
            }
        }
        return null;
    }

    private void repath(FloorGrid grid, double goalX, double goalY) {
        computePath(grid, FloorGrid.cellOf(goalX, goalY));
    }

    private void computePath(FloorGrid grid, int[] goal) {
        pathComputations++;
        path = AStarPathfinder.findPath(grid.walkableSnapshot(), FloorGrid.cellOf(x, y), goal);
        // El primer paso es la celda donde ya esta: se sigue desde el siguiente.
        pathIndex = path.size() > 1 ? 1 : path.size();
    }

    private void followPath(double deltaSeconds, FloorGrid grid) {
        if (pathIndex >= path.size()) {
            return;
        }
        int[] cell = path.get(pathIndex);
        double targetX = cell[0] * FloorGrid.TILE + FloorGrid.TILE / 2.0;
        double targetY = cell[1] * FloorGrid.TILE + FloorGrid.TILE / 2.0;
        double dx = targetX - x;
        double dy = targetY - y;
        double distance = Math.hypot(dx, dy);
        double step = config.speedPxPerSecond() * deltaSeconds;
        if (distance <= step) {
            moveTo(grid, targetX, targetY);
            pathIndex++;
            return;
        }
        moveTo(grid, x + dx / distance * step, y + dy / distance * step);
    }

    /** Por ejes, como {@link Zombie}: si la diagonal choca, desliza por la pared. */
    private void moveTo(FloorGrid grid, double nextX, double nextY) {
        if (grid.fits(nextX, y, BODY_RADIUS)) {
            x = nextX;
        }
        if (grid.fits(x, nextY, BODY_RADIUS)) {
            y = nextY;
        }
    }

    private Player nearest(List<Player> players) {
        Player best = null;
        double bestDistance = Double.MAX_VALUE;
        for (Player player : players) {
            if (!player.isAlive() || player.getFloor() != floor) {
                continue;
            }
            double distance = Math.hypot(player.getX() - x, player.getY() - y);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = player;
            }
        }
        return best;
    }

    public synchronized boolean isAlive() {
        return health > 0;
    }

    public synchronized BossState getState() {
        return state;
    }

    public synchronized int getFloor() {
        return floor;
    }

    public synchronized double getX() {
        return x;
    }

    public synchronized double getY() {
        return y;
    }

    public synchronized int getHealth() {
        return health;
    }

    /** Cuantas veces calculo un camino A* (para comprobar que no lo hace en cada tick). */
    synchronized int pathComputations() {
        return pathComputations;
    }

    public synchronized BossView toView() {
        return new BossView(id, NAME, floor, Math.round(x), Math.round(y), health, config.maxHealth(), state);
    }
}
