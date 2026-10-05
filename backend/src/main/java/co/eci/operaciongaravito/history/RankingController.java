package co.eci.operaciongaravito.history;

import co.eci.operaciongaravito.game.Building;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** GET /api/ranking?building=F: las mejores partidas guardadas de ese edificio. */
@RestController
public class RankingController {

    private final MatchHistoryService history;

    public RankingController(MatchHistoryService history) {
        this.history = history;
    }

    @GetMapping("/api/ranking")
    public MatchHistoryService.Ranking ranking(@RequestParam(defaultValue = "F") String building) {
        return history.ranking(Building.parseOrDefault(building));
    }
}
