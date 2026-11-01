package co.eci.operaciongaravito.game;

/**
 * Temporada (evento) de la sala: cambia la ambientacion que ven todos los de la sala,
 * no las reglas. NAVIDAD es la actual; HALLOWEEN queda como evento para quien lo
 * quiera jugar.
 */
public enum Temporada {
    NAVIDAD,
    HALLOWEEN;

    public static Temporada parseOrDefault(String value) {
        if (value == null) {
            return NAVIDAD;
        }
        try {
            return valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return NAVIDAD;
        }
    }
}
