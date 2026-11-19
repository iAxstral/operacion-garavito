package co.eci.operaciongaravito.game;

import java.util.List;

/**
 * Foto publica de un nodo para la pagina "Estado del servidor" (GET /api/estado). No
 * lleva los codigos de sala: con ellos cualquiera podria colarse en una partida ajena.
 * {@code tickP99Ms} es null si el servidor corre sin metricas (pruebas).
 */
public record EstadoServidor(
        String nodo,
        long segundosEncendido,
        int salas,
        int jugadores,
        int zombis,
        Double tickP99Ms,
        List<SalaEnVivo> partidas) {

    /** Una sala abierta: en que edificio, cuanta gente y en que Kinder va. */
    public record SalaEnVivo(
            String edificio,
            int jugadores,
            int zombis,
            boolean enCurso,
            int kinder,
            int kinders,
            boolean jefe) {
    }
}
