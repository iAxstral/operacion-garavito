package co.eci.operaciongaravito.game;

/**
 * Zombi comun. Su ataque ya no es una mordida instantanea al tocar al jugador: cuando
 * lo alcanza se prepara ({@link ZombieAttackPhase#WINDUP}) y recien al final muerde,
 * solo si el jugador sigue a su alcance. Asi la mordida se lee en pantalla y se puede
 * esquivar (alejarse o dash) o cortar con un golpe, que lo deja aturdido.
 */
public class Zombie {

    /** A esta distancia (centro a centro) empieza a prepararse para morder. */
    static final double ATTACK_TRIGGER_PX = 42;
    /** Alcance real de la mordida al soltarla: un poco mas que el gatillo, pero esquivable. */
    static final double BITE_REACH_PX = 58;
    static final double TOUGH_BITE_REACH_PX = 64;

    static final long WINDUP_MS = 420;
    static final long TOUGH_WINDUP_MS = 520;
    static final long STRIKE_RECOVER_MS = 650;
    static final long STAGGER_MS = 500;

    static final int BITE_DAMAGE = 4;
    static final int TOUGH_BITE_DAMAGE = 7;

    /** Mientras se recupera de una mordida o de un aturdimiento camina mas lento. */
    private static final double RECOVER_SPEED_FACTOR = 0.45;

    /** Escupidor: escupe si ve al jugador a esta distancia o menos. */
    static final double SPIT_RANGE_PX = 300;
    /** Escupidor: si ve al jugador mas cerca que esto, deja de acercarse. */
    static final double SPIT_HOLD_PX = 220;
    static final long SPIT_WINDUP_MS = 700;
    static final long SPIT_RECOVER_MS = 500;
    static final long SPIT_COOLDOWN_MS = 2_400;

    private final String id;
    private final int floor;
    private final double speed;
    private final boolean tough;
    private final ZombieKind kind;

    /** La preparacion en curso es un escupitajo (no una mordida). */
    private volatile boolean spitting;
    private volatile long nextSpitAt;
    private AcidProjectile pendingAcid;
    private int acidSequence;

    private volatile double x;
    private volatile double y;
    private volatile int health;

    private volatile ZombieAttackPhase phase = ZombieAttackPhase.CHASE;
    private volatile long phaseEndsAt;
    private Player attackTarget;

    private volatile long knockbackUntil;
    private volatile double knockbackVx;
    private volatile double knockbackVy;

    public Zombie(String id, int floor, double x, double y, int health, double speed) {
        this(id, floor, x, y, health, speed, ZombieKind.WALKER);
    }

    public Zombie(String id, int floor, double x, double y, int health, double speed, ZombieKind kind) {
        this.id = id;
        this.floor = floor;
        this.x = x;
        this.y = y;
        this.health = health;
        this.speed = speed;
        this.kind = kind;
        this.tough = kind == ZombieKind.WALKER && health >= WaveCurve.ZOMBIE_TOUGH_HEALTH;
    }

    public ZombieKind getKind() {
        return kind;
    }

    /** La bola de acido que acaba de escupir (una sola vez), o null. */
    public synchronized AcidProjectile consumeAcid() {
        AcidProjectile acid = pendingAcid;
        pendingAcid = null;
        return acid;
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

    public ZombieAttackPhase getPhase() {
        return phase;
    }

    public synchronized boolean hit(int damage, double knockbackVx, double knockbackVy, long now) {
        if (health <= 0) {
            return false;
        }
        health -= damage;
        this.knockbackVx = knockbackVx;
        this.knockbackVy = knockbackVy;
        this.knockbackUntil = now + 180;
        if (phase == ZombieAttackPhase.WINDUP) {
            // Pegarle mientras se prepara le corta la mordida (o el escupitajo).
            spitting = false;
            enterPhase(ZombieAttackPhase.STAGGER, now + STAGGER_MS);
        }
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
        } else if (phase == ZombieAttackPhase.WINDUP) {
            // Plantado mientras se prepara: solo lo mueve el empuje de los demas.
            moveX = separationX * deltaSeconds;
            moveY = separationY * deltaSeconds;
        } else if (kind == ZombieKind.SPITTER && phase == ZombieAttackPhase.CHASE
                && Math.hypot(targetX - x, targetY - y) <= SPIT_HOLD_PX
                && Math.hypot(targetX - x, targetY - y) > kind.triggerPx()
                && floor.hasLineOfSight(x, y, targetX, targetY)) {
            // El escupidor guarda distancia: si te ve, no se acerca mas.
            moveX = separationX * deltaSeconds;
            moveY = separationY * deltaSeconds;
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

            double currentSpeed = phase == ZombieAttackPhase.CHASE ? speed : speed * RECOVER_SPEED_FACTOR;
            moveX = dirX * currentSpeed * deltaSeconds + separationX * deltaSeconds;
            moveY = dirY * currentSpeed * deltaSeconds + separationY * deltaSeconds;
        }

        if (floor.fits(x + moveX, y, BODY_RADIUS)) {
            x += moveX;
        }
        if (floor.fits(x, y + moveY, BODY_RADIUS)) {
            y += moveY;
        }
    }

    /**
     * Avanza el ataque contra {@code target} (el jugador vivo mas cercano de su piso,
     * o null si no hay). Devuelve true si en este tick la mordida le hizo dano.
     */
    public synchronized boolean updateAttack(Player target, long now) {
        return updateAttack(target, null, now);
    }

    /**
     * Igual que {@link #updateAttack(Player, long)}; con la grilla del piso el
     * escupidor ademas puede escupir a distancia si ve al jugador.
     */
    public synchronized boolean updateAttack(Player target, FloorGrid grid, long now) {
        if (!isAlive()) {
            return false;
        }
        switch (phase) {
            case CHASE -> {
                if (target != null && distanceTo(target) <= kind.triggerPx()) {
                    attackTarget = target;
                    spitting = false;
                    enterPhase(ZombieAttackPhase.WINDUP, now + (tough ? TOUGH_WINDUP_MS : kind.windupMs()));
                } else if (canSpitAt(target, grid, now)) {
                    attackTarget = target;
                    spitting = true;
                    enterPhase(ZombieAttackPhase.WINDUP, now + SPIT_WINDUP_MS);
                }
            }
            case WINDUP -> {
                if (now >= phaseEndsAt) {
                    Player bitten = attackTarget;
                    if (spitting) {
                        spit(bitten, now);
                        return false;
                    }
                    enterPhase(ZombieAttackPhase.STRIKE, now + STRIKE_RECOVER_MS);
                    return bitten != null
                            && bitten.isAlive()
                            && bitten.getFloor() == floor
                            && distanceTo(bitten) <= (tough ? TOUGH_BITE_REACH_PX : kind.reachPx())
                            && bitten.takeBite(tough ? TOUGH_BITE_DAMAGE : kind.biteDamage(), now);
                }
            }
            case STRIKE, STAGGER -> {
                if (now >= phaseEndsAt) {
                    enterPhase(ZombieAttackPhase.CHASE, 0);
                }
            }
        }
        return false;
    }

    private boolean canSpitAt(Player target, FloorGrid grid, long now) {
        return kind == ZombieKind.SPITTER
                && grid != null
                && target != null
                && now >= nextSpitAt
                && distanceTo(target) <= SPIT_RANGE_PX
                && grid.hasLineOfSight(x, y, target.getX(), target.getY());
    }

    /** Suelta el acido hacia donde esta el objetivo AHORA: si se movio a tiempo, falla. */
    private void spit(Player target, long now) {
        if (target != null && target.isAlive() && target.getFloor() == floor) {
            double angle = Math.atan2(target.getY() - y, target.getX() - x);
            pendingAcid = new AcidProjectile(id + "-a" + (++acidSequence), floor, x, y, angle, now);
        }
        nextSpitAt = now + SPIT_COOLDOWN_MS;
        spitting = false;
        enterPhase(ZombieAttackPhase.STRIKE, now + SPIT_RECOVER_MS);
    }

    private void enterPhase(ZombieAttackPhase next, long endsAt) {
        phase = next;
        phaseEndsAt = endsAt;
        if (next != ZombieAttackPhase.WINDUP) {
            attackTarget = null;
        }
    }

    private double distanceTo(Player player) {
        return Math.hypot(player.getX() - x, player.getY() - y);
    }

    public ZombieState toState() {
        return new ZombieState(id, floor, Math.round(x), Math.round(y), health, tough, phase, kind, spitting);
    }
}
