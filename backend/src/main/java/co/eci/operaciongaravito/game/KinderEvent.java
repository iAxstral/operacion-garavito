package co.eci.operaciongaravito.game;

/**
 * Evento que aparece una vez en cada Kinder (desde el 2):
 * <ul>
 *   <li>{@code BLACKOUT}: apagon. Infraestructura lo arregla en el tablero electrico.</li>
 *   <li>{@code SUPPLY}: caja de suministros urgente; si nadie la recoge a tiempo, llega una horda.</li>
 * </ul>
 * Tal como viaja al cliente (con {@code endsInMs} ya calculado).
 */
public record KinderEvent(String id, Type type, String room, int floor, long x, long y, long endsInMs) {

    public enum Type {
        BLACKOUT,
        SUPPLY
    }
}
