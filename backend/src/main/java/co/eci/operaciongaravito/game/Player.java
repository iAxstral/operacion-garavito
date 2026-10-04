package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public class Player {

    public static final int MAX_INVENTORY_SLOTS = 5;
    /** Balas que trae cada paquete de municion. No ocupa espacio en el inventario. */
    public static final int AMMO_PER_PACK = 15;

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

    /**
     * Tras una mordida, las de otros zombis se ignoran un instante: si no, una horda
     * que muerde sincronizada derrite al jugador antes de que pueda reaccionar.
     */
    static final long BITE_GRACE_MS = 350;
    private volatile long biteGraceUntil = 0;

    private volatile Weapon equipped = Weapon.FISTS;
    private volatile int reserveAmmo = 0;
    private final Map<Weapon, Integer> magazines = new EnumMap<>(Weapon.class);
    private volatile long reloadingUntil = 0;
    private volatile Weapon reloadingWeapon = null;
    /** Cuenta los disparos para que los demas clientes dibujen las balas de este jugador. */
    private volatile int shotSeq = 0;
    private volatile double shotFacing = 0;

    private volatile long lastDamagedAt = 0;
    /** Compañero caido que este jugador (Biomedica) esta reviviendo, o null. */
    private volatile String reviveTargetId = null;
    private volatile long reviveStartedAt = 0;
    private volatile long reviveUntil = 0;

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
        lastDamagedAt = System.currentTimeMillis();
        if (health == 0) {
            lifeState = PlayerLifeState.DOWNED;
        }
        return true;
    }

    public long getLastDamagedAt() {
        return lastDamagedAt;
    }

    public String getReviveTargetId() {
        return reviveTargetId;
    }

    public long getReviveStartedAt() {
        return reviveStartedAt;
    }

    public long getReviveUntil() {
        return reviveUntil;
    }

    public synchronized void startRevive(String targetId, long now, long durationMs) {
        reviveTargetId = targetId;
        reviveStartedAt = now;
        reviveUntil = now + durationMs;
    }

    public synchronized void stopRevive() {
        reviveTargetId = null;
        reviveStartedAt = 0;
        reviveUntil = 0;
    }

    /** Avance (0..1) de la reanimacion que esta haciendo este jugador. */
    public double reviveProgress(long now) {
        String target = reviveTargetId;
        long until = reviveUntil;
        long started = reviveStartedAt;
        if (target == null || until <= started) {
            return 0;
        }
        return Math.min(1, Math.max(0, (now - started) / (double) (until - started)));
    }

    /** Dano de una mordida de zombi: respeta la ventana de gracia entre mordidas. */
    public synchronized boolean takeBite(int amount, long now) {
        if (now < biteGraceUntil) {
            return false;
        }
        boolean damaged = takeDamage(amount);
        if (damaged) {
            biteGraceUntil = now + BITE_GRACE_MS;
        }
        return damaged;
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

    public synchronized boolean owns(Weapon weapon) {
        return weapon == Weapon.FISTS
                || inventory.stream().anyMatch(slot -> weapon.itemId().equals(slot.itemId()));
    }

    public synchronized boolean tryAddItem(InventorySlot slot) {
        if (inventory.size() >= MAX_INVENTORY_SLOTS) {
            return false;
        }
        inventory.add(slot);
        onAcquired(slot);
        return true;
    }

    /** Un arma de fuego nueva llega con el cargador lleno. */
    private void onAcquired(InventorySlot slot) {
        Weapon weapon = Weapon.fromItemId(slot.itemId());
        if (weapon != null && weapon.ranged()) {
            magazines.putIfAbsent(weapon, weapon.magazineSize());
        }
    }

    public Weapon getEquipped() {
        return equipped;
    }

    /** Equipa un arma que el jugador tenga (null = puños). Cancela una recarga en curso. */
    public synchronized boolean equip(Weapon weapon) {
        Weapon target = weapon == null ? Weapon.FISTS : weapon;
        if (!owns(target)) {
            return false;
        }
        equipped = target;
        reloadingUntil = 0;
        reloadingWeapon = null;
        return true;
    }

    public synchronized void addAmmo(int rounds) {
        reserveAmmo += rounds;
    }

    public int getReserveAmmo() {
        return reserveAmmo;
    }

    /** Balas en el cargador de esa arma (termina primero una recarga ya cumplida). */
    public synchronized int magazine(Weapon weapon) {
        settleReload(System.currentTimeMillis());
        return loaded(weapon);
    }

    private int loaded(Weapon weapon) {
        return magazines.getOrDefault(weapon, 0);
    }

    public int getShotSeq() {
        return shotSeq;
    }

    public double getShotFacing() {
        return shotFacing;
    }

    /** Ms que faltan para terminar la recarga (0 si no esta recargando). */
    public synchronized long reloadingInMs(long now) {
        settleReload(now);
        return reloadingWeapon == null ? 0 : Math.max(0, reloadingUntil - now);
    }

    /** Empieza a recargar el arma equipada. Devuelve el motivo si no se puede, o null. */
    public synchronized String startReload(long now) {
        settleReload(now);
        Weapon weapon = equipped;
        if (!weapon.ranged()) {
            return "not_ranged";
        }
        if (reloadingWeapon != null) {
            return "reloading";
        }
        if (loaded(weapon) >= weapon.magazineSize()) {
            return "magazine_full";
        }
        if (reserveAmmo <= 0) {
            return "no_ammo";
        }
        reloadingWeapon = weapon;
        reloadingUntil = now + weapon.reloadMs();
        return null;
    }

    private void settleReload(long now) {
        if (reloadingWeapon == null || now < reloadingUntil) {
            return;
        }
        int missing = reloadingWeapon.magazineSize() - loaded(reloadingWeapon);
        int moved = Math.min(missing, reserveAmmo);
        magazines.put(reloadingWeapon, loaded(reloadingWeapon) + moved);
        reserveAmmo -= moved;
        reloadingWeapon = null;
        reloadingUntil = 0;
    }

    /**
     * Gasta una bala del arma de fuego equipada. Devuelve null si disparo, o el motivo
     * si no pudo; con el cargador vacio y balas de reserva empieza a recargar solo.
     */
    public synchronized String tryFire(long now, double facing) {
        settleReload(now);
        Weapon weapon = equipped;
        if (reloadingWeapon != null) {
            return "reloading";
        }
        int loaded = loaded(weapon);
        if (loaded <= 0) {
            return startReload(now) == null ? "reloading" : "no_ammo";
        }
        magazines.put(weapon, loaded - 1);
        shotSeq++;
        shotFacing = facing;
        return null;
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
        if (slot.type() != ItemType.AMMO && inventory.size() >= MAX_INVENTORY_SLOTS) {
            return PurchaseResult.rejected("inventory_full");
        }

        garavitos -= price;
        if (slot.type() == ItemType.AMMO) {
            reserveAmmo += AMMO_PER_PACK;
            return PurchaseResult.ok();
        }
        inventory.add(slot);
        onAcquired(slot);
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
        biteGraceUntil = 0;
        lastDamagedAt = 0;
        reviveTargetId = null;
        reviveStartedAt = 0;
        reviveUntil = 0;
        equipped = Weapon.FISTS;
        reserveAmmo = 0;
        magazines.clear();
        reloadingUntil = 0;
        reloadingWeapon = null;
        shotSeq = 0;
    }
}
