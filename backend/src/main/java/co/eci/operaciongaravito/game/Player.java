package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.List;

public class Player {

    public static final int MAX_INVENTORY_SLOTS = 5;

    private final String playerId;
    private final String role;
    private volatile int health = 100;
    private volatile int garavitos = 0;
    private final List<InventorySlot> inventory = new ArrayList<>();

    private volatile int floor = 1;
    private volatile double x = 608;
    private volatile double y = 800;
    private volatile PlayerLifeState lifeState = PlayerLifeState.ALIVE;
    private volatile long attackReadyAt = 0;
    private volatile long chargedReadyAt = 0;

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

    public int getFloor() {
        return floor;
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

    public void reportPosition(int floor, double x, double y) {
        this.floor = floor;
        this.x = x;
        this.y = y;
    }

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

    public synchronized void revive(int toHealth) {
        health = Math.max(health, toHealth);
        lifeState = PlayerLifeState.ALIVE;
    }

    public synchronized boolean tryConsumeAttackCooldown(long now, long cooldownMs) {
        if (now < attackReadyAt) {
            return false;
        }
        attackReadyAt = now + cooldownMs;
        return true;
    }

    public synchronized boolean tryConsumeChargedCooldown(long now, long cooldownMs) {
        if (now < chargedReadyAt) {
            return false;
        }
        chargedReadyAt = now + cooldownMs;
        return true;
    }

    public long chargedReadyInMs(long now) {
        return Math.max(0, chargedReadyAt - now);
    }

    public synchronized InventorySlot consumeFood(String itemId) {
        for (int i = 0; i < inventory.size(); i++) {
            InventorySlot slot = inventory.get(i);
            if (slot.itemId().equals(itemId) && slot.type() == ItemType.FOOD) {
                inventory.remove(i);
                return slot;
            }
        }
        return null;
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

    public synchronized PurchaseResult purchase(int price, InventorySlot slot) {
        if (garavitos < price) {
            return PurchaseResult.rejected("insufficient_garavitos");
        }
        if (inventory.size() >= MAX_INVENTORY_SLOTS) {
            return PurchaseResult.rejected("inventory_full");
        }

        garavitos -= price;
        inventory.add(slot);
        return PurchaseResult.ok();
    }

    public synchronized List<InventorySlot> inventorySnapshot() {
        return new ArrayList<>(inventory);
    }

    public synchronized void reset() {
        health = 100;
        garavitos = 0;
        inventory.clear();
        floor = 1;
        x = 608;
        y = 800;
        lifeState = PlayerLifeState.ALIVE;
        attackReadyAt = 0;
        chargedReadyAt = 0;
        invulnerable = false;
    }
}
