package co.eci.operaciongaravito.game;

/**
 * Tipos de zombi comun (espejo de los dibujos en frontend/src/game/ZombieLayer.js).
 * Cada uno define su vida, su velocidad relativa y como muerde.
 */
public enum ZombieKind {
    //            vida  velocidad  gatillo alcance preparacion dano
    WALKER(-1,    1.0,       42,     58,     420,        4),
    /** Rapido y fragil: llega primero y apura al jugador, pero cae de un golpe. */
    RUNNER(1,     1.7,       40,     54,     300,        3),
    /** Lento: escupe acido a distancia (ver {@link Zombie#SPIT_RANGE_PX}); de cerca muerde. */
    SPITTER(3,    0.8,       42,     58,     420,        4),
    /** Revienta al alcanzarte (alcance = radio de la explosion) y tambien al morir. */
    EXPLODER(2,   1.15,      40,     95,     520,        14),
    /** Al verte grita y enfurece a los zombis cercanos; de cerca muerde flojo. */
    SCREAMER(3,   0.9,       42,     58,     420,        3),
    /** No ve: solo te encuentra si estas muy cerca o haces ruido (disparar, pegar, correr). */
    BLIND(4,      1.25,      42,     60,     380,        6);

    private final int health;
    private final double speedFactor;
    private final double triggerPx;
    private final double reachPx;
    private final long windupMs;
    private final int biteDamage;

    ZombieKind(int health, double speedFactor, double triggerPx, double reachPx, long windupMs, int biteDamage) {
        this.health = health;
        this.speedFactor = speedFactor;
        this.triggerPx = triggerPx;
        this.reachPx = reachPx;
        this.windupMs = windupMs;
        this.biteDamage = biteDamage;
    }

    /** Vida fija del tipo, o -1 si la decide la curva (comun o resistente). */
    public int health() {
        return health;
    }

    public double speedFactor() {
        return speedFactor;
    }

    public double triggerPx() {
        return triggerPx;
    }

    public double reachPx() {
        return reachPx;
    }

    public long windupMs() {
        return windupMs;
    }

    public int biteDamage() {
        return biteDamage;
    }
}
