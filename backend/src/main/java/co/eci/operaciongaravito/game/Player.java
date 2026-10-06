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
    // Estadisticas de la corrida actual (pantalla de resultados y ranking).
    private int statKills;
    private int statMissions;
    private int statEarned;
    private int statDamage;
    private int statRevives;
    private int statDowns;
    /** Dulces que solto la horda a este jugador en la corrida (se guardan en su navegador). */
    private int statCandies;

    /** Ultima posicion aceptada (para validar la siguiente) y ultima correccion enviada. */
    private volatile long lastMoveAt = 0;
    private volatile long lastCorrectionAt = 0;
    private volatile int rejectedMoves = 0;

    /** Momento en que se cayo su conexion, o 0 si esta conectado. */
    private volatile long disconnectedAt = 0;
    /** Enfriamiento de la habilidad del rol (p. ej. la barricada de Infraestructura). */
    private volatile long abilityReadyAt = 0;
    /** Compañero caido que este jugador (Biomedica) esta reviviendo, o null. */
    private volatile String reviveTargetId = null;
    private volatile long reviveStartedAt = 0;
    private volatile long reviveUntil = 0;

    /** Armario en el que esta escondido (o null), hasta cuando, y desde cuando puede volver. */
    private volatile String hidingIn = null;
    private volatile long hiddenUntil = 0;
    private volatile long hideReadyAt = 0;

    /** Disfraz que lleva puesto (cosmetico, ver COSTUMES), o null. */
    private volatile String costume = null;

    /** Disfraces que existen: el cliente los vende y los dibuja; aqui solo se valida el id. */
    public static final java.util.Set<String> COSTUMES = java.util.Set.of(
            "CALABAZA", "BRUJA", "VAMPIRO", "CALAVERA", "DIABLO", "FANTASMA");

    /** Llego a la salida en el escape final: ya no lo ven ni lo dañan. */
    private volatile boolean escaped = false;

    /** Mejoras elegidas en la corrida y las tres que se le ofrecen ahora (o ninguna). */
    private final java.util.EnumSet<Perk> perks = java.util.EnumSet.noneOf(Perk.class);
    private List<Perk> perkOffer = List.of();
    private long lastRegenAt = 0;

    /** Hasta cuando "hace ruido" (disparo, golpe o correr): los zombis ciegos lo oyen. */
    private volatile long noiseUntil = 0;

    /** Apodo que eligio el jugador, o null (entonces se le llama por su rol). */
    private volatile String name = null;
    /** Ultimo aviso al equipo (pings): se limita para que nadie llene la pantalla. */
    private volatile long lastPingAt = 0;

    static final int MAX_NAME_LENGTH = 16;

    public Player(String role) {
        this.playerId = role;
        this.role = role;
    }

    public String getName() {
        return name;
    }

    public synchronized boolean hasPerk(Perk perk) {
        return perks.contains(perk);
    }

    public synchronized List<String> perkNames() {
        return perks.stream().map(Enum::name).toList();
    }

    public synchronized List<String> perkOfferNames() {
        return perkOffer.stream().map(Enum::name).toList();
    }

    /** Le ofrece hasta tres mejoras que todavia no tiene (reemplaza una oferta sin elegir). */
    public synchronized void offerPerks(java.util.random.RandomGenerator random) {
        List<Perk> available = new ArrayList<>(java.util.Arrays.stream(Perk.values()).filter(p -> !perks.contains(p)).toList());
        java.util.Collections.shuffle(available, new java.util.Random(random.nextLong()));
        perkOffer = List.copyOf(available.subList(0, Math.min(Perk.OFFER_SIZE, available.size())));
    }

    /** Elige una de las ofrecidas y aplica su efecto inmediato. False si no estaba en la oferta. */
    public synchronized boolean choosePerk(Perk perk) {
        if (perk == null || !perkOffer.contains(perk)) {
            return false;
        }
        perks.add(perk);
        perkOffer = List.of();
        if (perk == Perk.REFUERZO) {
            heal(Perk.REFUERZO_HEAL);
        } else if (perk == Perk.MUNICION) {
            reserveAmmo += Perk.MUNICION_ROUNDS;
        }
        return true;
    }

    /** Regeneracion: 1 de vida cada 3 s tras 5 s sin recibir daño. */
    public synchronized void regenerate(long now) {
        if (!perks.contains(Perk.REGENERACION) || !isAlive() || health >= 100) {
            return;
        }
        if (now - lastDamagedAt >= Perk.REGEN_IDLE_MS && now - lastRegenAt >= Perk.REGEN_EVERY_MS) {
            health += 1;
            lastRegenAt = now;
        }
    }

    public void makeNoise(long until) {
        noiseUntil = Math.max(noiseUntil, until);
    }

    public boolean isNoisy(long now) {
        return now < noiseUntil;
    }

    public String getCostume() {
        return costume;
    }

    /** Solo acepta disfraces que existen; cualquier otra cosa lo deja sin disfraz. */
    public void setCostume(String id) {
        costume = id != null && COSTUMES.contains(id) ? id : null;
    }

    public synchronized void addCandies(int amount) {
        statCandies += amount;
    }

    public synchronized int getCandies() {
        return statCandies;
    }

    public String getHidingIn() {
        return hidingIn;
    }

    public boolean isHidden() {
        return hidingIn != null;
    }

    public long hiddenMs(long now) {
        return hidingIn == null ? 0 : Math.max(0, hiddenUntil - now);
    }

    public synchronized boolean canHide(long now) {
        return now >= hideReadyAt;
    }

    public synchronized void hide(String spotId, long now, long maxMs) {
        hidingIn = spotId;
        hiddenUntil = now + maxMs;
    }

    /** Sale del armario y empieza la espera para volver a esconderse. */
    public synchronized void unhide(long now, long cooldownMs) {
        if (hidingIn == null) {
            return;
        }
        hidingIn = null;
        hiddenUntil = 0;
        hideReadyAt = now + cooldownMs;
    }

    /** True si se le acabo el tiempo escondido (y lo saca). */
    public synchronized boolean expireHide(long now, long cooldownMs) {
        if (hidingIn != null && now >= hiddenUntil) {
            unhide(now, cooldownMs);
            return true;
        }
        return false;
    }

    /** Guarda el apodo con los caracteres de control vueltos espacio, espacios simples y largo maximo 16. */
    public void setName(String raw) {
        if (raw == null) {
            name = null;
            return;
        }
        String clean = raw.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").strip();
        if (clean.length() > MAX_NAME_LENGTH) {
            clean = clean.substring(0, MAX_NAME_LENGTH).strip();
        }
        name = clean.isEmpty() ? null : clean;
    }

    /** true si ya paso el enfriamiento y registra este aviso. */
    public synchronized boolean tryPing(long now, long cooldownMs) {
        if (now - lastPingAt < cooldownMs) {
            return false;
        }
        lastPingAt = now;
        return true;
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

    public boolean isEscaped() {
        return escaped;
    }

    public synchronized void escape() {
        if (lifeState == PlayerLifeState.ALIVE) {
            escaped = true;
            hidingIn = null;
        }
    }

    /** Se acabo el tiempo del escape sin salir: la horda lo alcanza. */
    public synchronized void collapse() {
        if (lifeState == PlayerLifeState.ALIVE && !escaped) {
            health = 0;
            lifeState = PlayerLifeState.DOWNED;
            statDowns++;
        }
    }

    public synchronized boolean takeDamage(int amount) {
        if (lifeState == PlayerLifeState.DOWNED || invulnerable || hidingIn != null || escaped) {
            return false;
        }
        int before = health;
        health = Math.max(0, health - amount);
        statDamage += before - health;
        lastDamagedAt = System.currentTimeMillis();
        if (health == 0) {
            lifeState = PlayerLifeState.DOWNED;
            statDowns++;
        }
        return true;
    }

    public synchronized boolean tryConsumeAbility(long now, long cooldownMs) {
        if (now < abilityReadyAt) {
            return false;
        }
        abilityReadyAt = now + cooldownMs;
        return true;
    }

    public long abilityReadyInMs(long now) {
        return Math.max(0, abilityReadyAt - now);
    }

    /** Saca {@code amount} Garavitos si los tiene (para transferirlos). */
    public synchronized boolean tryTakeGaravitos(int amount) {
        if (amount <= 0 || garavitos < amount) {
            return false;
        }
        garavitos -= amount;
        return true;
    }

    public long getLastMoveAt() {
        return lastMoveAt;
    }

    public void setLastMoveAt(long now) {
        lastMoveAt = now;
    }

    public synchronized void countRejectedMove() {
        rejectedMoves++;
    }

    public int getRejectedMoves() {
        return rejectedMoves;
    }

    /** True si toca avisarle al cliente que corrija su posicion (como mucho cada {@code everyMs}). */
    public synchronized boolean shouldSendCorrection(long now, long everyMs) {
        if (now - lastCorrectionAt < everyMs) {
            return false;
        }
        lastCorrectionAt = now;
        return true;
    }

    public boolean isConnected() {
        return disconnectedAt == 0;
    }

    public long getDisconnectedAt() {
        return disconnectedAt;
    }

    public void markDisconnected(long now) {
        disconnectedAt = now;
    }

    public void markConnected() {
        disconnectedAt = 0;
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
        int bite = perks.contains(Perk.PIEL_DURA) ? Math.max(1, amount - 1) : amount;
        boolean damaged = takeDamage(bite);
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
        reloadingUntil = now + (perks.contains(Perk.RECARGA_RAPIDA)
                ? Math.round(weapon.reloadMs() * Perk.RELOAD_FACTOR) : weapon.reloadMs());
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

    /** Garavitos ganados (kills, misiones, jefe): suman al saldo y a las estadisticas. */
    public synchronized void addEarnings(int amount) {
        garavitos += amount;
        statEarned += amount;
    }

    public synchronized void recordKills(int kills) {
        statKills += kills;
    }

    public synchronized void recordMission() {
        statMissions++;
    }

    public synchronized void recordRevive() {
        statRevives++;
    }

    public synchronized MatchSummary.PlayerSummary statsSnapshot() {
        return new MatchSummary.PlayerSummary(role, statKills, statMissions, statEarned, statDamage, statRevives, statDowns, name,
                statCandies);
    }

    public synchronized void resetStats() {
        escaped = false;
        perks.clear();
        perkOffer = List.of();
        statCandies = 0;
        statKills = 0;
        statMissions = 0;
        statEarned = 0;
        statDamage = 0;
        statRevives = 0;
        statDowns = 0;
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
        escaped = false;
        perks.clear();
        perkOffer = List.of();
        health = 100;
        garavitos = 0;
        inventory.clear();
        floor = 1;
        x = 608;
        y = 800;
        lastMoveAt = 0;
        rejectedMoves = 0;
        statCandies = 0;
        statKills = 0;
        statMissions = 0;
        statEarned = 0;
        statDamage = 0;
        statRevives = 0;
        statDowns = 0;
        lifeState = PlayerLifeState.ALIVE;
        attackReadyAt = 0;
        chargedReadyAt = 0;
        invulnerable = false;
        biteGraceUntil = 0;
        lastDamagedAt = 0;
        abilityReadyAt = 0;
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
