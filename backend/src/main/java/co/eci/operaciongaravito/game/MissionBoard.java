package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.random.RandomGenerator;

/**
 * Misiones de cada jugador para el Kinder en curso, y la barrera que decide si el
 * equipo ya puede pasarlo.
 *
 * <p>Al empezar el respiro de cada Kinder se reparten {@link #MISSIONS_PER_KINDER}
 * misiones por jugador (tipos de su rol y salas al azar, distintas a las del Kinder
 * anterior). El Kinder solo se libera cuando cada jugador vivo "llego" a la barrera,
 * es decir, completo todas las suyas ({@link #allDone}); los caidos no la traban.
 *
 * <p>Concurrencia: las misiones se completan desde los hilos de mensajes de STOMP y
 * la barrera se consulta desde el hilo del tick. Todo el estado se protege con el
 * monitor de esta instancia, asi una mision nunca se cobra dos veces y el tick nunca
 * ve una asignacion a medio repartir.
 */
public class MissionBoard {

    public static final int MISSIONS_PER_KINDER = 3;

    private static final class Assignment {
        private final String missionId;
        private final MissionType type;
        private final MissionSite site;
        private final int reward;
        private boolean done;

        Assignment(String missionId, MissionType type, MissionSite site, int reward) {
            this.missionId = missionId;
            this.type = type;
            this.site = site;
            this.reward = reward;
        }

        MissionView view() {
            return new MissionView(missionId, type, site.siteId(), site.room(), site.floor(),
                    Math.round(site.x()), Math.round(site.y()), reward, done);
        }
    }

    private final Building building;
    private final RandomGenerator random;
    private final Map<String, List<Assignment>> byPlayer = new HashMap<>();
    private final Map<String, Set<String>> previousSites = new HashMap<>();
    private final Map<String, Set<MissionType>> previousTypes = new HashMap<>();
    private int kinder;
    private long sequence;

    public MissionBoard(Building building, RandomGenerator random) {
        this.building = building;
        this.random = random;
    }

    /** Kinder para el que estan repartidas las misiones (0 = ninguno todavia). */
    public synchronized int getKinder() {
        return kinder;
    }

    /** Reparte misiones nuevas a todos para el Kinder indicado. */
    public synchronized void deal(int kinder, Collection<Player> players) {
        this.kinder = kinder;
        byPlayer.forEach((playerId, list) -> {
            previousSites.put(playerId,
                    list.stream().map(a -> a.site.siteId()).collect(java.util.stream.Collectors.toSet()));
            previousTypes.put(playerId,
                    list.stream().map(a -> a.type).collect(java.util.stream.Collectors.toSet()));
        });
        byPlayer.clear();
        players.forEach(this::dealTo);
    }

    /** Un jugador que entra con el Kinder ya repartido recibe sus misiones. */
    public synchronized void ensureDealt(Player player) {
        if (kinder > 0 && !byPlayer.containsKey(player.getPlayerId())) {
            dealTo(player);
        }
    }

    public synchronized void remove(String playerId) {
        byPlayer.remove(playerId);
        previousSites.remove(playerId);
        previousTypes.remove(playerId);
    }

    public synchronized void reset() {
        byPlayer.clear();
        previousSites.clear();
        previousTypes.clear();
        kinder = 0;
    }

    private void dealTo(Player player) {
        Role role = Role.valueOf(player.getRole());
        // Tres minijuegos distintos del rol; primero los que no le tocaron en el Kinder
        // anterior, para que no se repitan siempre los mismos.
        Set<MissionType> lastTime = previousTypes.getOrDefault(player.getPlayerId(), Set.of());
        List<MissionType> types = new ArrayList<>(MissionType.forRole(role));
        Collections.shuffle(types, asRandom());
        types.sort(java.util.Comparator.comparingInt(type -> lastTime.contains(type) ? 1 : 0));
        while (types.size() < MISSIONS_PER_KINDER) {
            types.add(types.get(random.nextInt(types.size())));
        }

        List<MissionSite> sites = pickSites(player.getPlayerId());
        List<Assignment> list = new ArrayList<>();
        for (int i = 0; i < MISSIONS_PER_KINDER; i++) {
            list.add(new Assignment("m" + (++sequence), types.get(i), sites.get(i), MissionCatalog.rewardFor(kinder)));
        }
        byPlayer.put(player.getPlayerId(), list);
    }

    /**
     * Tres salas distintas, prefiriendo las que no uso en el Kinder anterior y las que
     * no le tocaron a otro jugador en este.
     */
    private List<MissionSite> pickSites(String playerId) {
        Set<String> previous = previousSites.getOrDefault(playerId, Set.of());
        Set<String> takenNow = new HashSet<>();
        byPlayer.values().forEach(list -> list.forEach(a -> takenNow.add(a.site.siteId())));

        List<MissionSite> all = new ArrayList<>(MissionCatalog.sitesFor(building));
        Collections.shuffle(all, asRandom());
        all.sort(java.util.Comparator.comparingInt(site ->
                (previous.contains(site.siteId()) ? 2 : 0) + (takenNow.contains(site.siteId()) ? 1 : 0)));
        return all.subList(0, MISSIONS_PER_KINDER);
    }

    private java.util.Random asRandom() {
        return new java.util.Random(random.nextLong());
    }

    public synchronized List<MissionView> viewFor(String playerId) {
        return byPlayer.getOrDefault(playerId, List.of()).stream().map(Assignment::view).toList();
    }

    /** La mision pendiente {@code missionId} de este jugador, o null si no es suya o ya la hizo. */
    public synchronized MissionView pending(String playerId, String missionId) {
        return byPlayer.getOrDefault(playerId, List.of()).stream()
                .filter(a -> a.missionId.equals(missionId) && !a.done)
                .map(Assignment::view)
                .findFirst()
                .orElse(null);
    }

    /** Marca la mision como hecha. True solo la primera vez (se paga una sola vez). */
    public synchronized boolean complete(String playerId, String missionId) {
        for (Assignment assignment : byPlayer.getOrDefault(playerId, List.of())) {
            if (assignment.missionId.equals(missionId) && !assignment.done) {
                assignment.done = true;
                return true;
            }
        }
        return false;
    }

    public synchronized int completed(String playerId) {
        return (int) byPlayer.getOrDefault(playerId, List.of()).stream().filter(a -> a.done).count();
    }

    /** La barrera: true si todos los jugadores vivos completaron sus misiones del Kinder. */
    public synchronized boolean allDone(Collection<Player> players) {
        return players.stream()
                .filter(Player::isAlive)
                .allMatch(player -> completed(player.getPlayerId()) >= MISSIONS_PER_KINDER);
    }

    /** Misiones hechas / requeridas por los jugadores vivos (para el HUD). */
    public synchronized int[] teamProgress(Collection<Player> players) {
        int done = 0;
        int required = 0;
        for (Player player : players) {
            if (!player.isAlive()) {
                continue;
            }
            done += Math.min(MISSIONS_PER_KINDER, completed(player.getPlayerId()));
            required += MISSIONS_PER_KINDER;
        }
        return new int[] { done, required };
    }
}
