package co.eci.operaciongaravito.history;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.Difficulty;
import co.eci.operaciongaravito.game.GameMode;
import co.eci.operaciongaravito.game.MatchSummary;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Historial de partidas para el ranking.
 *
 * <p>Guardar en la base no puede frenar el tick de la sala (que corre cada 66 ms y
 * mueve a todos los zombis), asi que {@link #saveAsync} encola el guardado en un
 * hilo propio y vuelve enseguida.
 */
@Service
public class MatchHistoryService {

    private static final System.Logger LOGGER = System.getLogger(MatchHistoryService.class.getName());

    private final MatchRecordRepository repository;

    /**
     * Cache corta del ranking por edificio y modo (security.api.ranking-cache-ms): pedirlo
     * en bucle no llega a la base. Se vacia al guardar una partida, asi el ranking nuevo
     * se ve enseguida. Las llaves son enums, asi que el mapa no puede crecer sin limite.
     */
    private record Cached(Ranking ranking, long expiresAt) {
    }

    private final java.util.Map<String, Cached> rankingCache = new java.util.concurrent.ConcurrentHashMap<>();
    private long rankingCacheMs = 8_000;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setSecurity(co.eci.operaciongaravito.security.SecurityProperties security) {
        this.rankingCacheMs = security.getApi().getRankingCacheMs();
    }
    private final ExecutorService writer = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "match-history-writer");
        thread.setDaemon(true);
        return thread;
    });

    public MatchHistoryService(MatchRecordRepository repository) {
        this.repository = repository;
    }

    public void saveAsync(MatchSummary summary) {
        writer.submit(() -> {
            try {
                save(summary);
            } catch (RuntimeException ex) {
                LOGGER.log(System.Logger.Level.WARNING, "no se pudo guardar la partida en el historial", ex);
            }
        });
    }

    @Transactional
    public MatchRecord save(MatchSummary summary) {
        rankingCache.clear();
        MatchRecord record = new MatchRecord(summary.building().name(), summary.victory(),
                summary.kinderReached(), summary.durationSeconds(), Instant.now(),
                summary.mode() == null ? GameMode.NORMAL.name() : summary.mode().name());
        summary.players().forEach(p -> record.addPlayer(new MatchPlayerRecord(
                p.role(), p.kills(), p.missions(), p.garavitosEarned(), p.damageTaken(), p.revives(), p.downs(),
                p.name())));
        return repository.save(record);
    }

    /** Lo que muestra el ranking de un edificio. */
    public record Ranking(String building, long matches, long victories, List<RankedMatch> best, String mode) {
    }

    public record RankedMatch(long id, boolean victory, int kinderReached, long durationSeconds, Instant playedAt,
                              int players, int totalKills, int totalMissions, String mvpRole, String mvpName) {
    }

    @Transactional(readOnly = true)
    public Ranking ranking(Building building) {
        return ranking(building, GameMode.NORMAL);
    }

    /**
     * Ranking de un edificio en un modo. El desafio del dia solo cuenta las partidas de
     * hoy (hora de Bogota), porque cada dia la regla es otra.
     */
    @Transactional(readOnly = true)
    public Ranking ranking(Building building, GameMode mode) {
        String key = building.name() + "/" + mode.name();
        long now = System.currentTimeMillis();
        Cached cached = rankingCache.get(key);
        if (cached != null && cached.expiresAt() > now) {
            return cached.ranking();
        }
        Ranking fresh = load(building, mode);
        if (rankingCacheMs > 0) {
            rankingCache.put(key, new Cached(fresh, now + rankingCacheMs));
        }
        return fresh;
    }

    private Ranking load(Building building, GameMode mode) {
        java.time.Instant since = mode == GameMode.DAILY
                ? java.time.LocalDate.now(Difficulty.ZONE).atStartOfDay(Difficulty.ZONE).toInstant()
                : Instant.EPOCH;
        List<RankedMatch> best = repository
                .findTop10ByBuildingAndModeAndPlayedAtGreaterThanEqualOrderByVictoryDescKinderReachedDescDurationSecondsAsc(
                        building.name(), mode.name(), since)
                .stream()
                .map(MatchHistoryService::toRanked)
                .toList();
        return new Ranking(building.name(),
                repository.countByBuildingAndModeAndPlayedAtGreaterThanEqual(building.name(), mode.name(), since),
                repository.countByBuildingAndModeAndPlayedAtGreaterThanEqualAndVictoryTrue(building.name(), mode.name(), since),
                best, mode.name());
    }

    private static RankedMatch toRanked(MatchRecord record) {
        int kills = record.getPlayers().stream().mapToInt(MatchPlayerRecord::getKills).sum();
        int missions = record.getPlayers().stream().mapToInt(MatchPlayerRecord::getMissions).sum();
        MatchPlayerRecord mvp = record.getPlayers().stream()
                .max(java.util.Comparator.comparingInt(p -> p.getKills() + 3 * p.getMissions() + 5 * p.getRevives()))
                .orElse(null);
        return new RankedMatch(record.getId(), record.isVictory(), record.getKinderReached(), record.getDurationSeconds(),
                record.getPlayedAt(), record.getPlayerCount(), kills, missions,
                mvp == null ? null : mvp.getRole(), mvp == null ? null : mvp.getPlayerName());
    }

    /** Vacia la cache del ranking (pruebas). */
    public void clearRankingCache() {
        rankingCache.clear();
    }

    @PreDestroy
    void shutdown() {
        writer.shutdown();
    }
}
