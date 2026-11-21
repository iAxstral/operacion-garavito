package co.eci.operaciongaravito.security;

import java.util.regex.Pattern;

/**
 * Formato de lo que llega por STOMP. Todo lo que no cumple se descarta antes de tocar la
 * sala (y se cuenta como bad_payload o bad_token).
 */
public final class Entrada {

    /** Codigo de sala (el servidor genera 6; se aceptan 4 a 8 por compatibilidad). */
    public static final Pattern CODIGO = Pattern.compile("[A-Z0-9]{4,8}");
    /** Id que inventa el cliente para reconocer sus respuestas. */
    public static final Pattern CLIENT_ID = Pattern.compile("[A-Za-z0-9-]{1,64}");
    /** Ids del servidor: objetos (shop-arepa), puertas (g2-planos), misiones (m3), barricadas (b2). */
    public static final Pattern ID = Pattern.compile("[a-z0-9-]{1,48}");
    /** Constantes: roles, perks, frases del chat, tipos de aviso, edificios, modos, disfraces. */
    public static final Pattern CONSTANTE = Pattern.compile("[A-Z_]{1,32}");
    /** Token secreto del puesto (el cliente usa crypto.randomUUID). */
    public static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9-]{16,64}");
    /** El apodo se limpia y recorta a 16 en Player; aqui solo se corta lo absurdo. */
    public static final int MAX_NOMBRE = 64;
    public static final int MAX_PISO = 10;

    private Entrada() {
    }

    public static boolean cumple(Pattern pattern, String value) {
        return value != null && pattern.matcher(value).matches();
    }

    /** null o con formato valido. */
    public static boolean opcional(Pattern pattern, String value) {
        return value == null || pattern.matcher(value).matches();
    }

    public static boolean nombre(String value) {
        return value == null || value.length() <= MAX_NOMBRE;
    }

    public static boolean finitos(double... values) {
        for (double value : values) {
            if (!Double.isFinite(value)) {
                return false;
            }
        }
        return true;
    }

    public static boolean piso(int floor) {
        return floor >= 1 && floor <= MAX_PISO;
    }
}
