package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.List;

/**
 * Estado de un jugador dentro de una {@link GameSession}. playerId == role:
 * cada partida tiene exactamente 4 roles fijos y unicos, asi que el rol ya
 * sirve como identificador sin necesitar un sistema de cuentas/autenticacion.
 *
 * Las mutaciones (agregar item, curar) son synchronized: aunque un solo
 * jugador rara vez dispara dos acciones en el mismo instante, es barato
 * garantizar que no se corrompa la lista de inventario si llegara a pasar.
 */
public class Player {

    public static final int MAX_INVENTORY_SLOTS = 5;

    private final String playerId;
    private final String role;
    private volatile int health = 100;
    private volatile int garavitos = 0; // se gana con misiones y zombis, no arranca con saldo
    private final List<InventorySlot> inventory = new ArrayList<>();

    // Posicion reportada por el cliente (ver /game/{id}/move). El servidor la
    // necesita de forma continua para que los zombis puedan perseguir; hasta
    // el primer reporte vale el spawn del piso 1 (mapLayout.js).
    private volatile double x = 608;
    private volatile double y = 800;
    private volatile PlayerLifeState lifeState = PlayerLifeState.ALIVE;
    private volatile long attackReadyAt = 0;
    /** True mientras el jugador esta dentro de una tarea de mision (ver GameSession.attemptStartMission). */
    private volatile boolean invulnerable = false;

    public Player(String role) {
        this.playerId = role;
        this.role = role;
    }

    public String getPlayerId() {
        return playerId;
    }

    public String getRole() {
        return role;
    }

    public int getHealth() {
        return health;
    }

    public int getGaravitos() {
        return garavitos;
    }

    public double getX() {
        return x;
    }

    public double getY() {
        return y;
    }

    public PlayerLifeState getLifeState() {
        return lifeState;
    }

    public boolean isAlive() {
        return lifeState == PlayerLifeState.ALIVE;
    }

    public boolean isInvulnerable() {
        return invulnerable;
    }

    public void setInvulnerable(boolean invulnerable) {
        this.invulnerable = invulnerable;
    }

    public void reportPosition(double x, double y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Daño recibido de un zombi. Devuelve si el golpe se aplico: un jugador
     * ya caido no vuelve a recibir daño, para que los zombis dejen de
     * "castigar" un cuerpo y pasen al siguiente objetivo.
     */
    public synchronized boolean takeDamage(int amount) {
        if (lifeState == PlayerLifeState.DOWNED || invulnerable) {
            return false;
        }
        health = Math.max(0, health - amount);
        if (health == 0) {
            lifeState = PlayerLifeState.DOWNED;
        }
        return true;
    }

    /** Levanta al jugador al terminar la oleada. */
    public synchronized void revive(int toHealth) {
        health = Math.max(health, toHealth);
        lifeState = PlayerLifeState.ALIVE;
    }

    /** True si el arma ya salio de cooldown; reserva el proximo golpe. */
    public synchronized boolean tryConsumeAttackCooldown(long now, long cooldownMs) {
        if (now < attackReadyAt) {
            return false;
        }
        attackReadyAt = now + cooldownMs;
        return true;
    }

    public synchronized boolean hasWeapon() {
        return inventory.stream().anyMatch(slot -> slot.type() == ItemType.WEAPON);
    }

    public synchronized boolean tryAddItem(InventorySlot slot) {
        if (inventory.size() >= MAX_INVENTORY_SLOTS) {
            return false;
        }
        inventory.add(slot);
        return true;
    }

    public synchronized void heal(int amount) {
        health = Math.min(100, health + amount);
    }

    public synchronized void addGaravitos(int amount) {
        garavitos += amount;
    }

    /**
     * Compra atomica: chequea saldo + cupo de inventario, descuenta, agrega
     * el item y (si aplica) cura, todo en una sola seccion critica. Los
     * Garavitos y el inventario son estado *individual* de este jugador —
     * no compiten con otros jugadores como si pasa con los items del mapa
     * (ver GameSession.attemptPickup) — asi que alcanza con el lock
     * intrinseco de este objeto: dos compras casi simultaneas del MISMO
     * jugador se serializan aca, sin bloquear a los demas jugadores (cada
     * uno tiene su propio Player, su propio lock).
     */
    public synchronized PurchaseResult purchase(int price, InventorySlot slot, int healAmount) {
        if (garavitos < price) {
            return PurchaseResult.rejected("insufficient_garavitos");
        }
        if (inventory.size() >= MAX_INVENTORY_SLOTS) {
            return PurchaseResult.rejected("inventory_full");
        }

        garavitos -= price;
        inventory.add(slot);
        if (healAmount > 0) {
            health = Math.min(100, health + healAmount);
        }
        return PurchaseResult.ok();
    }

    public synchronized List<InventorySlot> inventorySnapshot() {
        return new ArrayList<>(inventory);
    }

    /** Vuelve al jugador a como arranca una partida nueva (ver GameSession.resetGame). */
    public synchronized void reset() {
        health = 100;
        garavitos = 0;
        inventory.clear();
        x = 608;
        y = 800;
        lifeState = PlayerLifeState.ALIVE;
        attackReadyAt = 0;
        invulnerable = false;
    }
}
