package co.eci.operaciongaravito.game;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Cuanto aprietan los zombis segun el modo de la sala. Se aplica al aparecer cada zombi
 * (vida, velocidad y mordida) y al tope de vivos simultaneos.
 *
 * <p>El desafio del dia suma una regla que cambia cada dia (hora de Bogota) y es la
 * misma para todas las salas: asi el ranking del dia compara corridas parejas.
 */
public record Difficulty(
        GameMode mode,
        double healthFactor,
        double speedFactor,
        double maxAliveFactor,
        int biteBonus,
        String dailyRule) {

    public static final ZoneId ZONE = ZoneId.of("America/Bogota");

    /** Reglas del desafio del dia, en el orden en que rotan. */
    public enum DailyRule {
        /** Zombis un 30 % mas rapidos. */
        HORDA_VELOZ,
        /** Zombis con un 60 % mas de vida. */
        TANQUES,
        /** Cada mordida hace 3 mas. */
        MORDIDA_FEROZ,
        /** Hasta un 50 % mas de zombis a la vez. */
        MAREA,
        /** Linternas mas cortas (cliente) y zombis un poco mas rapidos. */
        NOCHE_CERRADA
    }

    public static final Difficulty NORMAL = new Difficulty(GameMode.NORMAL, 1, 1, 1, 0, null);
    public static final Difficulty HARD = new Difficulty(GameMode.HARD, 1.5, 1.15, 1.3, 2, null);

    public static Difficulty forMode(GameMode mode) {
        return forMode(mode, LocalDate.now(ZONE));
    }

    public static Difficulty forMode(GameMode mode, LocalDate day) {
        return switch (mode) {
            case NORMAL -> NORMAL;
            case HARD -> HARD;
            case DAILY -> daily(ruleFor(day));
        };
    }

    public static DailyRule ruleFor(LocalDate day) {
        DailyRule[] rules = DailyRule.values();
        return rules[(int) Math.floorMod(day.toEpochDay(), (long) rules.length)];
    }

    /** El desafio parte de un poco mas dificil que lo normal y le suma su regla. */
    static Difficulty daily(DailyRule rule) {
        double health = 1.2;
        double speed = 1.05;
        double maxAlive = 1.1;
        int bite = 1;
        switch (rule) {
            case HORDA_VELOZ -> speed = 1.3;
            case TANQUES -> health = 1.6;
            case MORDIDA_FEROZ -> bite = 3;
            case MAREA -> maxAlive = 1.5;
            case NOCHE_CERRADA -> speed = 1.12;
        }
        return new Difficulty(GameMode.DAILY, health, speed, maxAlive, bite, rule.name());
    }

    public int scaleHealth(int health) {
        return Math.max(1, (int) Math.round(health * healthFactor));
    }
}
