package co.eci.operaciongaravito.game;

/**
 * Que jefe es. El Ingeniero de Sistemas cierra la corrida en el Kinder 5; en la
 * temporada de Navidad, ademas, Papa Noel malvado aparece en el Kinder 3: es mas
 * debil, pero hay que derribarlo para pasar ese Kinder.
 */
public enum BossKind {
    INGENIERO("Ingeniero de Sistemas"),
    PAPA_NOEL("Papá Noel malvado");

    private final String displayName;

    BossKind(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }

    /** Ajusta la IA del jefe base: Papa Noel aguanta menos, va algo mas lento y muerde menos. */
    public BossConfig adjust(BossConfig base) {
        if (this == INGENIERO) {
            return base;
        }
        return new BossConfig(base.detectionRadiusTiles(), base.attackRadiusTiles(), base.repathMs(), base.alertMs(),
                base.stunMs(), base.loseTargetMs(), base.speedPxPerSecond() * 0.9,
                Math.max(1, (int) Math.round(base.maxHealth() * 0.7)),
                Math.max(1, (int) Math.round(base.biteDamage() * 0.75)), base.attackCooldownMs());
    }
}
