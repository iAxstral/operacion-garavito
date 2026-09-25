package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WaveDirectorTest {

    private static final long START = 1_000_000L;
    private static final long DELAY = 5_000L;

    private static List<FloorGrid> floorsOf(Building building) {
        return IntStream.rangeClosed(1, building.floorCount())
                .mapToObj(floor -> FloorGrid.forFloor(building, floor))
                .toList();
    }

    private static Player playerAt(String role, int floor, double x, double y) {
        Player player = new Player(role);
        player.reportPosition(floor, x, y);
        return player;
    }

    /** Corre ticks de 66 ms hasta {@code untilMs}, acumulando los zombis spawneados. */
    private static long run(WaveDirector director, long from, long untilMs, List<Player> players,
                            List<Zombie> alive) {
        long now = from;
        while (now < untilMs) {
            now += 66;
            alive.addAll(director.update(now, alive.size(), players));
        }
        return now;
    }

    @Test
    @DisplayName("el Kinder 1 empieza al terminar el respiro inicial y no antes")
    void firstKinderStartsAfterThePreparation() {
        WaveDirector director = new WaveDirector(START, DELAY, floorsOf(Building.F));
        List<Player> players = List.of(playerAt("SEGURIDAD", 1, 608, 800));
        List<Zombie> alive = new ArrayList<>();

        run(director, START, START + DELAY - 100, players, alive);
        assertEquals(0, director.getKinder());
        assertTrue(alive.isEmpty());
        assertTrue(director.state(START + 1000).restingSeconds() > 0);

        run(director, START + DELAY - 100, START + DELAY + 2000, players, alive);
        assertEquals(1, director.getKinder());
        assertFalse(alive.isEmpty());
    }

    @Test
    @DisplayName("aparecen muchos zombis a la vez pero nunca mas del tope del Kinder")
    void burstsRespectTheAliveCap() {
        WaveDirector director = new WaveDirector(START, 0, floorsOf(Building.F));
        List<Player> players = List.of(playerAt("SEGURIDAD", 1, 608, 800));
        List<Zombie> alive = new ArrayList<>();

        run(director, START, START + 60_000, players, alive);
        int cap = WaveCurve.maxAlive(WaveCurve.blueprint(1), 1);
        assertEquals(cap, alive.size(), "sin matar a nadie deberia llenarse hasta el tope");
    }

    @Test
    @DisplayName("se pasa el Kinder al llegar a la cuota de kills, no antes")
    void kinderAdvancesOnKillQuota() {
        WaveDirector director = new WaveDirector(START, 0, floorsOf(Building.F));
        List<Player> players = List.of(playerAt("SEGURIDAD", 1, 608, 800));
        List<Zombie> alive = new ArrayList<>();
        long now = run(director, START, START + 2000, players, alive);

        int quota = WaveCurve.blueprint(1).killQuota();
        director.onZombiesKilled(quota - 1);
        now = run(director, now, now + 200, players, alive);
        assertEquals(1, director.state(now).remaining());
        assertFalse(director.consumeJustCleared());

        director.onZombiesKilled(1);
        now = run(director, now, now + 200, players, alive);
        assertTrue(director.consumeJustCleared(), "deberia avisar que se paso el Kinder");
        assertFalse(director.consumeJustCleared(), "el aviso sale una sola vez");
        assertTrue(director.state(now).restingSeconds() > 0, "deberia empezar el respiro");

        run(director, now, now + WaveCurve.WAVE_REST_MS + 500, players, alive);
        assertEquals(2, director.getKinder());
    }

    @Test
    @DisplayName("los kills durante el respiro no cuentan para el siguiente Kinder")
    void killsWhileRestingDoNotCount() {
        WaveDirector director = new WaveDirector(START, DELAY, floorsOf(Building.F));
        director.onZombiesKilled(50);
        List<Zombie> alive = new ArrayList<>();
        long now = run(director, START, START + DELAY + 500, List.of(playerAt("SEGURIDAD", 1, 608, 800)), alive);
        assertEquals(0, director.state(now).kills());
    }

    @Test
    @DisplayName("tras los 5 Kinders se gana la corrida y no aparece nada mas")
    void fiveKindersWinTheRun() {
        WaveDirector director = new WaveDirector(START, 0, floorsOf(Building.C));
        List<Player> players = List.of(playerAt("SEGURIDAD", 1, 608, 800));
        long now = START;
        for (int k = 1; k <= WaveCurve.KINDER_COUNT; k++) {
            List<Zombie> alive = new ArrayList<>();
            now = run(director, now, now + WaveCurve.WAVE_REST_MS + 500, players, alive);
            assertEquals(k, director.getKinder());
            director.onZombiesKilled(WaveCurve.blueprint(k).killQuota());
            now = run(director, now, now + 100, players, new ArrayList<>());
            assertTrue(director.consumeJustCleared());
        }
        assertTrue(director.isVictory());
        assertTrue(director.state(now).victory());

        List<Zombie> after = new ArrayList<>();
        run(director, now, now + 60_000, players, after);
        assertTrue(after.isEmpty(), "despues de ganar no deberian aparecer zombis");
    }

    @Test
    @DisplayName("aparecen zombis en todos los pisos con jugadores, incluido el piso 1")
    void zombiesSpawnOnEveryOccupiedFloor() {
        WaveDirector director = new WaveDirector(START, 0, floorsOf(Building.F));
        List<Player> players = List.of(
                playerAt("SEGURIDAD", 1, 608, 800),
                playerAt("SALUD", 3, 608, 800));
        List<Zombie> alive = new ArrayList<>();
        run(director, START, START + 30_000, players, alive);

        Set<Integer> floors = new HashSet<>();
        alive.forEach(zombie -> floors.add(zombie.getFloor()));
        assertEquals(Set.of(1, 3), floors, "solo en los pisos con gente, y en todos ellos");
    }

    @Test
    @DisplayName("los zombis aparecen repartidos y lejos del jugador")
    void zombiesSpawnFromEverywhereAwayFromThePlayer() {
        WaveDirector director = new WaveDirector(START, 0, floorsOf(Building.F));
        Player player = playerAt("SEGURIDAD", 1, 608, 800);
        List<Zombie> alive = new ArrayList<>();
        run(director, START, START + 60_000, List.of(player), alive);

        Set<String> distinctCells = new HashSet<>();
        alive.forEach(zombie -> {
            assertTrue(Math.hypot(zombie.getX() - player.getX(), zombie.getY() - player.getY())
                    >= WaveDirector.MIN_SPAWN_DISTANCE_PX, "un zombi aparecio encima del jugador");
            distinctCells.add((int) zombie.getX() / 64 + ":" + (int) zombie.getY() / 64);
        });
        assertTrue(distinctCells.size() >= alive.size() / 2, "los spawns no deberian repetir siempre la misma celda");
    }

    @Test
    @DisplayName("reiniciar la corrida vuelve al Kinder 1")
    void resetRunGoesBackToKinderOne() {
        WaveDirector director = new WaveDirector(START, 0, floorsOf(Building.F));
        List<Player> players = List.of(playerAt("SEGURIDAD", 1, 608, 800));
        long now = run(director, START, START + 1000, players, new ArrayList<>());
        director.onZombiesKilled(WaveCurve.blueprint(1).killQuota());
        now = run(director, now, now + WaveCurve.WAVE_REST_MS + 1000, players, new ArrayList<>());
        assertEquals(2, director.getKinder());

        director.resetRun(now, 1000);
        assertEquals(0, director.getKinder());
        run(director, now, now + 1500, players, new ArrayList<>());
        assertEquals(1, director.getKinder());
    }
}
