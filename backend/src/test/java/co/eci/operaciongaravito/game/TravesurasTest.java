package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.random.RandomGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TravesurasTest {

    private static final int FLOOR = 1;
    private static final double DT = 0.066;

    private FloorGrid grid;
    private Player player;
    private Travesuras travesuras;
    private long now;

    @BeforeEach
    void setUp() {
        grid = FloorGrid.forFloor(Building.F, FLOOR);
        player = new Player("SEGURIDAD");
        double[] spot = openSpot();
        player.reportPosition(FLOOR, spot[0], spot[1]);
        now = 1_000_000;
        travesuras = new Travesuras(RandomGenerator.of("L64X128MixRandom"), now);
    }

    /** Un punto caminable con mucho espacio alrededor, para que el duende tenga donde aparecer. */
    private double[] openSpot() {
        double[] best = null;
        int bestCount = -1;
        for (double y = FloorGrid.TILE / 2.0; y < grid.pixelHeight(); y += FloorGrid.TILE) {
            for (double x = FloorGrid.TILE / 2.0; x < grid.pixelWidth(); x += FloorGrid.TILE) {
                if (!grid.isWalkable(x, y)) {
                    continue;
                }
                int count = 0;
                for (int a = 0; a < 16; a++) {
                    double angle = a * Math.PI / 8;
                    if (grid.isWalkable(x + Math.cos(angle) * 220, y + Math.sin(angle) * 220)
                            && grid.hasLineOfSight(x, y, x + Math.cos(angle) * 220, y + Math.sin(angle) * 220)) {
                        count++;
                    }
                }
                if (count > bestCount) {
                    bestCount = count;
                    best = new double[] { x, y };
                }
            }
        }
        return best;
    }

    private void tick(int times, boolean active) {
        for (int i = 0; i < times; i++) {
            now += 66;
            travesuras.update(now, DT, active, 3, List.of(player), floor -> grid);
        }
    }

    @Test
    @DisplayName("un duende aparece cerca, con linea de vision, y su bola de nieve le pega a quien no se mueve")
    void elfHitsAStandingPlayer() {
        travesuras.soltar(Travesuras.Tipo.DUENDE, player, now, floor -> grid);
        Travesuras.BromistaState duende = travesuras.state().bromistas().get(0);
        double distance = Math.hypot(duende.x() - player.getX(), duende.y() - player.getY());
        assertTrue(distance >= 160 && distance <= 270, "aparece a distancia de tiro: " + distance);
        assertTrue(grid.hasLineOfSight(duende.x(), duende.y(), player.getX(), player.getY()));

        int health = player.getHealth();
        Travesuras.GolpeState golpe = null;
        for (int i = 0; i < 60 && golpe == null; i++) {
            tick(1, true);
            golpe = travesuras.state().golpes().stream().findFirst().orElse(null);
        }
        assertTrue(golpe != null, "la bola deberia pegarle");
        assertEquals("SEGURIDAD", golpe.playerId());
        assertEquals(Travesuras.Tipo.DUENDE, golpe.tipo());
        assertEquals(health, player.getHealth(), "la nieve solo ciega, no quita vida");
    }

    @Test
    @DisplayName("el barro del reno mancha y quita un poco de vida")
    void reindeerMudHurts() {
        travesuras.soltar(Travesuras.Tipo.RENO, player, now, floor -> grid);
        int health = player.getHealth();
        tick(60, true);
        assertEquals(health - Travesuras.Tipo.RENO.dano, player.getHealth());
    }

    @Test
    @DisplayName("si el jugador se mueve despues del tiro, la bola se esquiva")
    void movingDodgesTheThrow() {
        travesuras.soltar(Travesuras.Tipo.DUENDE, player, now, floor -> grid);
        // Espera a que tire y se corre hacia el lado contrario de donde viene la bola.
        while (travesuras.state().bolas().isEmpty()) {
            tick(1, true);
        }
        Travesuras.BolaState bola = travesuras.state().bolas().get(0);
        double side = bola.angle() + Math.PI / 2;
        double x = player.getX() + Math.cos(side) * 96;
        double y = player.getY() + Math.sin(side) * 96;
        if (!grid.isWalkable(x, y)) {
            x = player.getX() - Math.cos(side) * 96;
            y = player.getY() - Math.sin(side) * 96;
        }
        player.reportPosition(FLOOR, x, y);
        tick(40, true);
        assertTrue(travesuras.state().golpes().isEmpty(), "no deberia haber golpe");
    }

    @Test
    @DisplayName("fuera de un Kinder activo no aparece nadie, y al limpiar se van todos")
    void onlyDuringAnActiveKinder() {
        tick((int) (Travesuras.ENTRE_MAX_MS / 66) + 5, false);
        assertTrue(travesuras.state().bromistas().isEmpty());

        boolean seen = false;
        for (int i = 0; i < (Travesuras.ENTRE_MAX_MS / 66) * 2 && !seen; i++) {
            tick(1, true);
            seen = !travesuras.state().bromistas().isEmpty();
        }
        assertTrue(seen, "en un Kinder activo aparece alguno");

        travesuras.soltar(Travesuras.Tipo.DUENDE, player, now, floor -> grid);
        travesuras.limpiar(now);
        assertTrue(travesuras.state().bromistas().isEmpty());
        assertTrue(travesuras.state().bolas().isEmpty());
    }
}
