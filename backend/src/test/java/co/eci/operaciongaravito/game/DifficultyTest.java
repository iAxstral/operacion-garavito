package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DifficultyTest {

    private static List<Zombie> fill(Difficulty difficulty) {
        List<FloorGrid> floors = IntStream.rangeClosed(1, Building.F.floorCount())
                .mapToObj(floor -> FloorGrid.forFloor(Building.F, floor)).toList();
        WaveDirector director = new WaveDirector(0, 0, floors);
        director.setDifficulty(difficulty);
        Player player = new Player("SEGURIDAD");
        player.reportPosition(1, 608, 800);
        List<Zombie> alive = new ArrayList<>();
        for (long now = 0; now < 60_000; now += 66) {
            alive.addAll(director.update(now, alive.size(), List.of(player)));
        }
        return alive;
    }

    @Test
    @DisplayName("el modo dificil llena mas el mapa y con zombis mas duros")
    void hardModeIsHarder() {
        int cap = WaveCurve.maxAlive(WaveCurve.blueprint(1), 1);
        assertEquals(cap, fill(Difficulty.NORMAL).size());
        List<Zombie> hard = fill(Difficulty.HARD);
        assertEquals(Math.round(cap * Difficulty.HARD.maxAliveFactor()), hard.size());
        assertTrue(hard.stream().allMatch(z -> z.toState().health() >= 2), "vida x1.5: ninguno queda en 1");
    }

    @Test
    @DisplayName("el desafio del dia rota sus reglas dia a dia y es el mismo todo el dia")
    void dailyRotates() {
        LocalDate day = LocalDate.of(2026, 10, 31);
        assertEquals(Difficulty.ruleFor(day), Difficulty.ruleFor(day));
        assertNotEquals(Difficulty.ruleFor(day), Difficulty.ruleFor(day.plusDays(1)));
        Set<Difficulty.DailyRule> week = new HashSet<>();
        for (int i = 0; i < Difficulty.DailyRule.values().length; i++) {
            week.add(Difficulty.ruleFor(day.plusDays(i)));
        }
        assertEquals(Difficulty.DailyRule.values().length, week.size(), "pasan todas antes de repetir");
    }

    @Test
    @DisplayName("cada regla del dia pesa en lo suyo")
    void dailyRules() {
        assertEquals(1.6, Difficulty.daily(Difficulty.DailyRule.TANQUES).healthFactor());
        assertEquals(3, Difficulty.daily(Difficulty.DailyRule.MORDIDA_FEROZ).biteBonus());
        assertEquals(1.5, Difficulty.daily(Difficulty.DailyRule.MAREA).maxAliveFactor());
        Difficulty daily = Difficulty.forMode(GameMode.DAILY, LocalDate.of(2026, 10, 31));
        assertEquals(GameMode.DAILY, daily.mode());
        assertEquals(Difficulty.ruleFor(LocalDate.of(2026, 10, 31)).name(), daily.dailyRule());
        assertNull(Difficulty.forMode(GameMode.HARD).dailyRule());
    }

    @Test
    @DisplayName("la sala dice su modo en el lobby y lo lleva al resumen")
    void sessionCarriesMode() {
        GameSession session = new GameSession("DURO", Building.F, BossConfig.defaults(), Difficulty.HARD);
        assertEquals(GameMode.HARD, session.lobbyState().mode());
        assertEquals(GameMode.NORMAL, GameMode.parseOrDefault("raro"));
        assertEquals(GameMode.DAILY, GameMode.parseOrDefault("daily"));
    }
}
