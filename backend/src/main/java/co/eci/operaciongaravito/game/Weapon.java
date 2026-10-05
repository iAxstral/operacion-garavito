package co.eci.operaciongaravito.game;

import java.util.Arrays;

/**
 * Armas del juego, en espejo con frontend/src/game/weaponCatalog.js. Las cuerpo a
 * cuerpo pegan en un arco frente al jugador; las de fuego disparan un rayo que se
 * corta en la primera pared (o puerta cerrada) y gastan balas del cargador.
 */
public enum Weapon {

    //      itemId          ranged dano  alcance cd   empuje cargador recarga atraviesa
    FISTS(null,             false, 1,    56,     700, 170,   0,       0,      1),
    AXE("shop-hacha",       false, 3,    76,     520, 320,   0,       0,      1),
    PISTOL("shop-pistola",  true,  2,    460,    340, 140,   8,       1100,   1),
    RIFLE("shop-rifle",     true,  5,    680,    800, 260,   5,       1700,   3);

    private final String itemId;
    private final boolean ranged;
    private final int damage;
    private final double range;
    private final long cooldownMs;
    private final double knockback;
    private final int magazineSize;
    private final long reloadMs;
    private final int pierce;

    Weapon(String itemId, boolean ranged, int damage, double range, long cooldownMs, double knockback,
           int magazineSize, long reloadMs, int pierce) {
        this.itemId = itemId;
        this.ranged = ranged;
        this.damage = damage;
        this.range = range;
        this.cooldownMs = cooldownMs;
        this.knockback = knockback;
        this.magazineSize = magazineSize;
        this.reloadMs = reloadMs;
        this.pierce = pierce;
    }

    /** El arma que corresponde a un item de inventario, o null si el item no es un arma. */
    public static Weapon fromItemId(String itemId) {
        if (itemId == null) {
            return null;
        }
        return Arrays.stream(values()).filter(w -> itemId.equals(w.itemId)).findFirst().orElse(null);
    }

    public String itemId() {
        return itemId;
    }

    public boolean ranged() {
        return ranged;
    }

    public int damage() {
        return damage;
    }

    public double range() {
        return range;
    }

    public long cooldownMs() {
        return cooldownMs;
    }

    public double knockback() {
        return knockback;
    }

    public int magazineSize() {
        return magazineSize;
    }

    public long reloadMs() {
        return reloadMs;
    }

    /** Cuantos zombis puede atravesar una bala. */
    public int pierce() {
        return pierce;
    }
}
