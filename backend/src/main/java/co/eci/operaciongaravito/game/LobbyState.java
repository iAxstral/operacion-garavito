package co.eci.operaciongaravito.game;

import java.util.Map;

/**
 * {@code dailyRule}: la regla del desafio del dia (solo en modo DAILY).
 * {@code votes}: voto de edificio de cada jugador presente (rol -> edificio), mientras
 * la sala espera. {@code leading}: el edificio que ganaria si se empezara ya.
 * {@code building} es el de la partida una vez empezada.
 */
public record LobbyState(boolean started, String host, Building building, GameMode mode, String dailyRule,
        Map<String, String> votes, Building leading) {
}
