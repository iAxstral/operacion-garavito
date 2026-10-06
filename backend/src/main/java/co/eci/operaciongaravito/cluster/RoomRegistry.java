package co.eci.operaciongaravito.cluster;

/**
 * Que nodo tiene cada sala. Las salas viven en la memoria de un solo nodo (el tick
 * necesita el estado a mano), asi que con varios nodos un jugador que pide una sala que
 * no esta aqui se redirige al nodo que la tiene (afinidad por codigo de sala).
 *
 * <p>Con un solo nodo se usa {@link InMemoryRoomRegistry}; con el perfil {@code cluster},
 * {@link RedisRoomRegistry}, compartido por todos los nodos.
 */
public interface RoomRegistry {

    /**
     * Intenta quedarse con la sala {@code code} para el nodo {@code nodeUrl}. Devuelve
     * true si la sala quedo (o ya estaba) a nombre de este nodo.
     */
    boolean claim(String code, String nodeUrl);

    /** URL publica del nodo que tiene la sala, o null si nadie la tiene. */
    String ownerOf(String code);

    /** Renueva la reserva mientras la sala siga viva (las reservas caducan solas). */
    void refresh(String code, String nodeUrl);

    /** La sala se cerro en este nodo. */
    void release(String code, String nodeUrl);
}
