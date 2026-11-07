package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.MatchSummary;
import co.eci.operaciongaravito.history.MatchHistoryService;
import co.eci.operaciongaravito.history.MatchRecordRepository;
import jakarta.persistence.EntityManagerFactory;
import java.util.List;
import javax.sql.DataSource;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * /api/ranking no deberia costar una consulta por partida (N+1) ni ir a la base en cada
 * peticion: alguien que lo pide en bucle no debe poder saturar PostgreSQL.
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "security.api.ranking-cache-ms=60000",
})
class RankingRendimientoTest {

    @Autowired
    MatchHistoryService history;

    @Autowired
    MatchRecordRepository repository;

    @Autowired
    EntityManagerFactory emf;

    @Autowired
    DataSource dataSource;

    private Statistics stats;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        for (int i = 0; i < 10; i++) {
            history.save(new MatchSummary(i, Building.C, i % 2 == 0, 3, 300 + i, List.of(
                    new MatchSummary.PlayerSummary("SEGURIDAD", 5, 2, 50, 30, 0, 1, "Lina", 3),
                    new MatchSummary.PlayerSummary("SALUD", 1, 3, 75, 10, 2, 0, null, 0))));
        }
        history.clearRankingCache();
        stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
    }

    @Test
    @DisplayName("el ranking de 10 partidas no hace una consulta por cada una (sin N+1)")
    void rankingHasNoNPlusOne() {
        MatchHistoryService.Ranking ranking = history.ranking(Building.C);
        assertEquals(10, ranking.best().size());
        assertTrue(stats.getPrepareStatementCount() <= 4,
                "consultas: " + stats.getPrepareStatementCount() + " (con N+1 serian 13)");
    }

    @Test
    @DisplayName("pedir el ranking muchas veces seguidas no vuelve a la base (cache corto)")
    void rankingIsCached() {
        history.ranking(Building.C);
        long first = stats.getPrepareStatementCount();
        for (int i = 0; i < 50; i++) {
            history.ranking(Building.C);
        }
        assertEquals(first, stats.getPrepareStatementCount(), "las repeticiones deberian salir de la cache");
    }

    @Test
    @DisplayName("la llave foranea match_player.match_id tiene indice")
    void foreignKeyIsIndexed() throws Exception {
        try (var connection = dataSource.getConnection();
                var rs = connection.getMetaData().getIndexInfo(null, null, "MATCH_PLAYER", false, false)) {
            boolean found = false;
            while (rs.next()) {
                String column = rs.getString("COLUMN_NAME");
                String name = rs.getString("INDEX_NAME");
                if ("MATCH_ID".equalsIgnoreCase(column) && name != null && name.toLowerCase().startsWith("idx_")) {
                    found = true;
                }
            }
            assertTrue(found, "falta un indice propio sobre match_player(match_id)");
        }
    }
}
