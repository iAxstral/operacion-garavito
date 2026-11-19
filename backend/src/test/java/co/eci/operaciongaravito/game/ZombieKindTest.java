package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ZombieKindTest {

    private static final long T0 = 1_000_000;
    private static final int FLOOR = 2;

    private FloorGrid grid;
    private Player player;
    private double[] corridor;

    @BeforeEach
    void setUp() {
        grid = FloorGrid.forFloor(Building.F, FLOOR);
        corridor = findCorridor(grid, 450);
        player = new Player("SEGURIDAD");
        player.reportPosition(FLOOR, corridor[0], corridor[1]);
    }

    private static double[] findCorridor(FloorGrid grid, double length) {
        for (int row = 1; row * FloorGrid.TILE < grid.pixelHeight(); row++) {
            double y = row * FloorGrid.TILE + FloorGrid.TILE / 2.0;
            double run = 0;
            for (double x = FloorGrid.TILE / 2.0; x < grid.pixelWidth(); x += FloorGrid.TILE) {
                run = grid.isWalkable(x, y) ? run + FloorGrid.TILE : 0;
                if (run >= length) {
                    return new double[] { x - run + FloorGrid.TILE, y };
                }
            }
        }
        throw new AssertionError("sin pasillo recto");
    }

    private Zombie spitterAt(double dx) {
        return new Zombie("s1", FLOOR, corridor[0] + dx, corridor[1], ZombieKind.SPITTER.health(), 50, ZombieKind.SPITTER);
    }

    @Test
    @DisplayName("el corredor se prepara menos y muerde mas suave")
    void runnerBitesFasterButWeaker() {
        Zombie runner = new Zombie("r1", FLOOR, corridor[0] + 30, corridor[1], 1, 100, ZombieKind.RUNNER);
        runner.updateAttack(player, T0);
        assertEquals(ZombieAttackPhase.WINDUP, runner.getPhase());
        assertTrue(runner.updateAttack(player, T0 + ZombieKind.RUNNER.windupMs()));
        assertEquals(100 - ZombieKind.RUNNER.biteDamage(), player.getHealth());
        assertFalse(runner.isTough());
    }

    @Test
    @DisplayName("el escupidor escupe acido a distancia si ve al jugador")
    void spitterSpitsFromAfar() {
        Zombie spitter = spitterAt(200);
        spitter.updateAttack(player, grid, T0);
        assertEquals(ZombieAttackPhase.WINDUP, spitter.getPhase());
        assertTrue(spitter.toState().spitting());
        assertNull(spitter.consumeAcid(), "todavia se esta preparando");

        spitter.updateAttack(player, grid, T0 + Zombie.SPIT_WINDUP_MS);
        AcidProjectile acid = spitter.consumeAcid();
        assertNotNull(acid);
        assertNull(spitter.consumeAcid(), "se entrega una sola vez");
        assertEquals(ZombieAttackPhase.STRIKE, spitter.getPhase());
    }

    @Test
    @DisplayName("el acido daña al jugador que alcanza y se puede esquivar")
    void acidHitsOrMisses() {
        Zombie spitter = spitterAt(200);
        spitter.updateAttack(player, grid, T0);
        spitter.updateAttack(player, grid, T0 + Zombie.SPIT_WINDUP_MS);
        AcidProjectile acid = spitter.consumeAcid();

        long now = T0 + Zombie.SPIT_WINDUP_MS;
        boolean alive = true;
        for (int i = 0; i < 60 && alive; i++) {
            now += 33;
            alive = acid.step(grid, List.of(player), 0.033, now);
        }
        assertFalse(alive);
        assertEquals(100 - AcidProjectile.DAMAGE, player.getHealth());

        // Segundo escupitajo: el jugador se corre a tiempo y el acido sigue de largo.
        Zombie other = spitterAt(200);
        Player dodger = new Player("SALUD");
        dodger.reportPosition(FLOOR, corridor[0], corridor[1]);
        other.updateAttack(dodger, grid, T0);
        other.updateAttack(dodger, grid, T0 + Zombie.SPIT_WINDUP_MS);
        AcidProjectile miss = other.consumeAcid();
        dodger.reportPosition(FLOOR, corridor[0], corridor[1] + 60);
        now = T0;
        for (int i = 0; i < 80; i++) {
            now += 33;
            if (!miss.step(grid, List.of(dodger), 0.033, now)) {
                break;
            }
        }
        assertEquals(100, dodger.getHealth(), "esquivo el acido");
    }

    @Test
    @DisplayName("el escupidor no escupe sin linea de vision ni fuera de rango")
    void spitterNeedsSightAndRange() {
        Zombie far = spitterAt(Zombie.SPIT_RANGE_PX + 80);
        far.updateAttack(player, grid, T0);
        assertEquals(ZombieAttackPhase.CHASE, far.getPhase());

        Zombie blind = spitterAt(200);
        blind.updateAttack(player, null, T0);
        assertEquals(ZombieAttackPhase.CHASE, blind.getPhase(), "sin grilla no evalua el escupitajo");
    }

    @Test
    @DisplayName("golpear al escupidor mientras carga le corta el escupitajo")
    void hittingTheSpitterInterrupts() {
        Zombie spitter = spitterAt(200);
        spitter.updateAttack(player, grid, T0);
        spitter.hit(1, 0, 0, T0 + 100);
        assertEquals(ZombieAttackPhase.STAGGER, spitter.getPhase());
        spitter.updateAttack(player, grid, T0 + Zombie.SPIT_WINDUP_MS);
        assertNull(spitter.consumeAcid());
    }

    @Test
    @DisplayName("los tipos aparecen segun el Kinder")
    void kindsDependOnTheKinder() {
        assertEquals(ZombieKind.WALKER, WaveCurve.rollKind(WaveCurve.blueprint(1), 0.0), "Kinder 1 solo comunes");
        assertEquals(ZombieKind.RUNNER, WaveCurve.rollKind(WaveCurve.blueprint(2), 0.0));
        assertEquals(ZombieKind.WALKER, WaveCurve.rollKind(WaveCurve.blueprint(2), 0.3), "Kinder 2 sin escupidores");
        assertEquals(ZombieKind.SPITTER, WaveCurve.rollKind(WaveCurve.blueprint(3), 0.3));
        assertEquals(ZombieKind.EXPLODER, WaveCurve.rollKind(WaveCurve.blueprint(3), 0.42));
        assertEquals(ZombieKind.SCREAMER, WaveCurve.rollKind(WaveCurve.blueprint(3), 0.50));
        assertEquals(ZombieKind.BLIND, WaveCurve.rollKind(WaveCurve.blueprint(3), 0.55));
        assertEquals(ZombieKind.WALKER, WaveCurve.rollKind(WaveCurve.blueprint(3), 0.9));
    }
}
