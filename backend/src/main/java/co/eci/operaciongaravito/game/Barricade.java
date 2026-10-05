package co.eci.operaciongaravito.game;

/**
 * Barricada de Infraestructura: bloquea una celda del piso (los zombis la rodean o,
 * si no hay otro camino, la golpean hasta romperla). Se puede reparar.
 */
public class Barricade {

    public static final double MAX_HEALTH = 20;
    /** Dano por segundo que le hace cada zombi pegado a ella. */
    static final double ZOMBIE_DPS = 1.6;
    static final double BOSS_DPS = 5;
    static final double REPAIR_AMOUNT = 8;

    private final String id;
    private final String ownerId;
    private final int floor;
    private final int col;
    private final int row;
    private double health = MAX_HEALTH;

    public Barricade(String id, String ownerId, int floor, int col, int row) {
        this.id = id;
        this.ownerId = ownerId;
        this.floor = floor;
        this.col = col;
        this.row = row;
    }

    public String getId() {
        return id;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public int getFloor() {
        return floor;
    }

    public int getCol() {
        return col;
    }

    public int getRow() {
        return row;
    }

    public double centerX() {
        return col * FloorGrid.TILE + FloorGrid.TILE / 2.0;
    }

    public double centerY() {
        return row * FloorGrid.TILE + FloorGrid.TILE / 2.0;
    }

    /** Resta vida; devuelve true si con esto se rompio. */
    public synchronized boolean damage(double amount) {
        health = Math.max(0, health - amount);
        return health <= 0;
    }

    public synchronized void repair(double amount) {
        health = Math.min(MAX_HEALTH, health + amount);
    }

    public synchronized double getHealth() {
        return health;
    }

    public BarricadeState toState() {
        return new BarricadeState(id, ownerId, floor, col, row, (int) Math.ceil(getHealth()), (int) MAX_HEALTH);
    }
}
