package co.eci.operaciongaravito.history;

import co.eci.operaciongaravito.game.Building;
import co.eci.operaciongaravito.game.Difficulty;
import co.eci.operaciongaravito.game.GameMode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/ranking?building=F&amp;mode=HARD: las mejores partidas de ese edificio y modo.
 * GET /api/daily: la regla del desafio de hoy.
 */
@RestController
public class RankingController {

    private final MatchHistoryService history;

    public RankingController(MatchHistoryService history) {
        this.history = history;
    }

    @GetMapping("/api/ranking")
    public MatchHistoryService.Ranking ranking(@RequestParam(defaultValue = "F") String building,
                                               @RequestParam(defaultValue = "NORMAL") String mode) {
        return history.ranking(Building.parseOrDefault(building), GameMode.parseOrDefault(mode));
    }

    public record DailyChallenge(String date, String rule) {
    }

    @GetMapping("/api/daily")
    public DailyChallenge daily() {
        java.time.LocalDate today = java.time.LocalDate.now(Difficulty.ZONE);
        return new DailyChallenge(today.toString(), Difficulty.ruleFor(today).name());
    }
}
