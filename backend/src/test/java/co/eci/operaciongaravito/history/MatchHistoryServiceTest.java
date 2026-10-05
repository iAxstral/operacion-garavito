package co.eci.operaciongaravito.history;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.MatchSummary;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Contra la base H2 del perfil dev, con el esquema que crea Flyway. */
@SpringBootTest
@ActiveProfiles("dev")
class MatchHistoryServiceTest {

    @Autowired
    private MatchHistoryService history;

    @Autowired
    private MatchRecordRepository repository;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    private static MatchSummary summary(boolean victory, int kinder, long seconds, int kills) {
        return new MatchSummary(1, Building.C, victory, kinder, seconds, List.of(
                new MatchSummary.PlayerSummary("SEGURIDAD", kills, 2, 50, 30, 0, 1),
                new MatchSummary.PlayerSummary("SALUD", 1, 3, 75, 10, 2, 0)));
    }

    @Test
    @DisplayName("guarda la partida con sus jugadores y la devuelve en el ranking")
    void savesAndRanks() {
        history.save(summary(false, 3, 400, 10));
        history.save(summary(true, 5, 900, 20));
        history.save(summary(true, 5, 700, 5));
        history.save(summary(false, 4, 300, 1));

        MatchHistoryService.Ranking ranking = history.ranking(Building.C);
        assertEquals(4, ranking.matches());
        assertEquals(2, ranking.victories());
        List<MatchHistoryService.RankedMatch> best = ranking.best();
        assertTrue(best.get(0).victory());
        assertEquals(700, best.get(0).durationSeconds(), "entre victorias gana la mas rapida");
        assertEquals(900, best.get(1).durationSeconds());
        assertEquals(4, best.get(2).kinderReached(), "despues el Kinder mas alto");
        assertEquals(2, best.get(0).players());
        assertEquals(6, best.get(0).totalKills());
        assertEquals("SALUD", best.get(0).mvpRole(), "revivir y misiones pesan en el MVP");
    }

    @Test
    @DisplayName("el ranking es por edificio")
    void rankingIsPerBuilding() {
        history.save(summary(true, 5, 500, 9));
        assertEquals(0, history.ranking(Building.F).matches());
    }
}
