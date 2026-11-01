package co.eci.operaciongaravito.game;

/**
 * {@code dailyRule}: la regla del desafio del dia (solo en modo DAILY). {@code temporada}:
 * la ambientacion de la sala (Navidad o Halloween), la misma para todos sus jugadores.
 */
public record LobbyState(boolean started, String host, Building building, GameMode mode, String dailyRule,
        Temporada temporada) {
}
