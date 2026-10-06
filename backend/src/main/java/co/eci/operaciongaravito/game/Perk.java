package co.eci.operaciongaravito.game;

/**
 * Mejoras que se eligen entre Kinders (una por respiro, de tres que se ofrecen). Duran
 * la corrida. Las que dicen "cliente" las aplica el navegador (no afectan las reglas).
 */
public enum Perk {
    /** Cura 40 al elegirla. */
    REFUERZO,
    /** Recarga un 35 % mas rapido. */
    RECARGA_RAPIDA,
    /** +1 de daño con armas cuerpo a cuerpo. */
    GOLPE_FUERTE,
    /** Las mordidas hacen 1 menos (minimo 1). */
    PIEL_DURA,
    /** Recupera 1 de vida cada 3 s si lleva 5 s sin recibir daño. */
    REGENERACION,
    /** +20 balas de reserva al elegirla. */
    MUNICION,
    /** Cliente: +50 % de energia para correr. */
    ENERGIA,
    /** Cliente: cono de linterna un 35 % mas largo. */
    LINTERNA;

    public static final int OFFER_SIZE = 3;
    static final double RELOAD_FACTOR = 0.65;
    static final int REFUERZO_HEAL = 40;
    static final int MUNICION_ROUNDS = 20;
    static final long REGEN_IDLE_MS = 5_000;
    static final long REGEN_EVERY_MS = 3_000;
}
