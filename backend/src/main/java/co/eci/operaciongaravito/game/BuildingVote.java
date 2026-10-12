package co.eci.operaciongaravito.game;

import java.util.Collection;
import java.util.EnumMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Votacion del edificio en la sala de espera: cada jugador vota (y puede cambiar su
 * voto) hasta que el anfitrion empieza. Al empezar gana el edificio con mas votos
 * entre los jugadores que siguen en la sala; quien se fue no cuenta.
 *
 * <p>Varios jugadores votan a la vez desde hilos distintos de STOMP: cada voto es un
 * {@code put} atomico del mapa concurrente (el ultimo voto de un jugador reemplaza al
 * anterior, nunca se suman dos). Cerrar la votacion y contar lo hace {@link GameSession}
 * bajo su monitor, el mismo que toman {@code vote} y {@code start}, asi que un voto
 * llega antes del conteo (y cuenta) o despues (y se rechaza): nunca a medias.
 */
public class BuildingVote {

    private final Map<String, Building> votes = new ConcurrentHashMap<>();

    public void vote(String role, Building building) {
        votes.put(role, building);
    }

    public void remove(String role) {
        votes.remove(role);
    }

    public void clear() {
        votes.clear();
    }

    /** Votos de los jugadores presentes, ordenados por rol (estable para comparar estados). */
    public Map<String, String> snapshot(Collection<String> present) {
        Map<String, String> copy = new TreeMap<>();
        votes.forEach((role, building) -> {
            if (present.contains(role)) {
                copy.put(role, building.name());
            }
        });
        return copy;
    }

    /**
     * Edificio ganador entre los votos de {@code present}. Empate: el voto del anfitrion
     * si esta entre los empatados; si no, {@code fallback} si esta; si no, el primero en
     * el orden del enum. Sin votos, {@code fallback}.
     */
    public Building winner(Collection<String> present, String host, Building fallback) {
        Map<Building, Integer> counts = new EnumMap<>(Building.class);
        votes.forEach((role, building) -> {
            if (present.contains(role)) {
                counts.merge(building, 1, Integer::sum);
            }
        });
        if (counts.isEmpty()) {
            return fallback;
        }
        int best = counts.values().stream().max(Integer::compare).orElse(0);
        Building hostVote = host == null ? null : votes.get(host);
        if (hostVote != null && present.contains(host) && counts.getOrDefault(hostVote, 0) == best) {
            return hostVote;
        }
        if (counts.getOrDefault(fallback, 0) == best) {
            return fallback;
        }
        return counts.entrySet().stream()
                .filter(entry -> entry.getValue() == best)
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(fallback);
    }
}
