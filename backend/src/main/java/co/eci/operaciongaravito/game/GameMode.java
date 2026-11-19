package co.eci.operaciongaravito.game;

/** Modo de la sala: normal, dificil, o el desafio del dia (el mismo para todos ese dia). */
public enum GameMode {
    NORMAL,
    HARD,
    DAILY;

    public static GameMode parseOrDefault(String value) {
        if (value == null) {
            return NORMAL;
        }
        try {
            return valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return NORMAL;
        }
    }
}
