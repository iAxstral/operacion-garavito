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
        List<PlayerSummary> players,
        GameMode mode) {

    public MatchSummary(long id, Building building, boolean victory, int kinderReached, long durationSeconds,
                        List<PlayerSummary> players) {
        this(id, building, victory, kinderReached, durationSeconds, players, GameMode.NORMAL);
    }

    /**
     * Estadisticas de un jugador en la corrida. {@code snowballsTaken} y
     * {@code snowballsDodged}: bolas de nieve o de barro de las travesuras que le pegaron y
     * que iban por el y se perdieron (no se guardan en el historial, como los regalos).
     */
    public record PlayerSummary(
            String role,
            int kills,
            int missions,
            int garavitosEarned,
            int damageTaken,
            int revives,
            int downs,
            String name,
            int candies,
            int snowballsTaken,
            int snowballsDodged) {

        /** Sin estadisticas de travesuras (historial y pruebas viejas). */
        public PlayerSummary(String role, int kills, int missions, int garavitosEarned, int damageTaken, int revives,
                int downs, String name, int candies) {
            this(role, kills, missions, garavitosEarned, damageTaken, revives, downs, name, candies, 0, 0);
        }
    }
}
