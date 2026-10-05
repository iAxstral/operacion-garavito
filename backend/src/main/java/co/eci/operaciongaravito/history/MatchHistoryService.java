package co.eci.operaciongaravito.history;

import co.eci.operaciongaravito.game.Building;
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
        MatchRecord record = new MatchRecord(summary.building().name(), summary.victory(),
                summary.kinderReached(), summary.durationSeconds(), Instant.now());
        summary.players().forEach(p -> record.addPlayer(new MatchPlayerRecord(
                p.role(), p.kills(), p.missions(), p.garavitosEarned(), p.damageTaken(), p.revives(), p.downs(),
                p.name())));
        return repository.save(record);
    }

    /** Lo que muestra el ranking de un edificio. */
    public record Ranking(String building, long matches, long victories, List<RankedMatch> best) {
    }

    public record RankedMatch(long id, boolean victory, int kinderReached, long durationSeconds, Instant playedAt,
                              int players, int totalKills, int totalMissions, String mvpRole, String mvpName) {
    }

    @Transactional(readOnly = true)
    public Ranking ranking(Building building) {
        List<RankedMatch> best = repository
                .findTop10ByBuildingOrderByVictoryDescKinderReachedDescDurationSecondsAsc(building.name())
                .stream()
                .map(MatchHistoryService::toRanked)
                .toList();
        return new Ranking(building.name(), repository.countByBuilding(building.name()),
                repository.countByBuildingAndVictoryTrue(building.name()), best);
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

    @PreDestroy
    void shutdown() {
        writer.shutdown();
    }
}
