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
    private final List<InventorySlot> inventory = new ArrayList<>();

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

    public synchronized List<InventorySlot> inventorySnapshot() {
        return new ArrayList<>(inventory);
    }
}
