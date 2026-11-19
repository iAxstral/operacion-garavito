package co.eci.operaciongaravito.game;

/** {@code dailyRule}: la regla del desafio del dia (solo en modo DAILY). */
public record LobbyState(boolean started, String host, Building building, GameMode mode, String dailyRule) {
}
