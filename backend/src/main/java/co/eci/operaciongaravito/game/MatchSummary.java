package co.eci.operaciongaravito.game;

import java.util.List;

/**
 * Resumen de una corrida terminada (victoria o equipo caido): lo que muestra la
 * pantalla de resultados y lo que se guarda en el historial para el ranking.
 */
public record MatchSummary(
        long id,
        Building building,
        boolean victory,
        int kinderReached,
        long durationSeconds,
        List<PlayerSummary> players) {

    public record PlayerSummary(
            String role,
            int kills,
            int missions,
            int garavitosEarned,
            int damageTaken,
            int revives,
            int downs,
            String name,
            int candies) {
    }
}
