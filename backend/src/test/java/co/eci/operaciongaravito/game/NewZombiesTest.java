package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class NewZombiesTest {

    private GameSession session;
    private Player player;
    private Map<String, Zombie> zombies;
    private double[] corridor;
    private long now;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        session = new GameSession("NUEV", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD");
        session.start("SEGURIDAD");
        player = session.getOrCreatePlayer("SEGURIDAD");
        java.lang.reflect.Field field = GameSession.class.getDeclaredField("zombies");
        field.setAccessible(true);
        zombies = (Map<String, Zombie>) field.get(session);
        corridor = findCorridor(FloorGrid.forFloor(Building.F, 1), 500);
        player.reportPosition(1, corridor[0], corridor[1]);
        now = System.currentTimeMillis();
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

    private Zombie add(String id, double dx, ZombieKind kind, int health, double speed) {
        Zombie zombie = new Zombie(id, 1, corridor[0] + dx, corridor[1], health, speed, kind);
        zombies.put(id, zombie);
        return zombie;
    }

    private void run(long ms) {
        for (long t = 0; t < ms; t += 50) {
            now += 50;
            session.tick(now, 0.05);
        }
    }

    @Test
    @DisplayName("el explosivo revienta al alcanzar: daña al jugador y a los zombis cercanos")
    void exploderBlowsUp() {
        add("bomba", 30, ZombieKind.EXPLODER, 2, 0);
        Zombie neighbour = add("vecino", 80, ZombieKind.WALKER, 2, 0);
        run(800);
        assertEquals(100 - ZombieKind.EXPLODER.biteDamage(), player.getHealth());
        assertFalse(zombies.containsKey("bomba"), "el explosivo murio al reventar");
        assertFalse(neighbour.isAlive(), "la explosion mato al de al lado");
        assertFalse(session.blastStates().isEmpty(), "el cliente ve la explosion");
    }

    @Test
    @DisplayName("el explosivo que matan tambien revienta, y en cadena")
    void exploderChain() {
        Zombie first = add("b1", 200, ZombieKind.EXPLODER, 2, 0);
        Zombie second = add("b2", 260, ZombieKind.EXPLODER, 2, 0);
        first.hit(5, 0, 0, now);
        run(100);
        assertFalse(second.isAlive(), "el segundo murio por la primera explosion");
        assertEquals(2, session.blastStates().size());
        assertEquals(100, player.getHealth(), "estaba lejos de las dos");
    }

    @Test
    @DisplayName("el ciego no encuentra a un jugador callado, pero si al que hace ruido")
    void blindHearsNoise() {
        Zombie blind = add("ciego", 320, ZombieKind.BLIND, 4, 100);
        double start = blind.getX();
        run(500);
        assertEquals(start, blind.getX(), 0.01, "callado y lejos: no se mueve");
        player.makeNoise(now + 5_000);
        run(500);
        assertTrue(blind.getX() < start - 10, "con ruido se acerca");
    }

    @Test
    @DisplayName("el griton grita al ver al jugador y enfurece a los zombis cercanos")
    void screamerEnrages() {
        add("griton", 200, ZombieKind.SCREAMER, 3, 0);
        Zombie walker = add("comun", 300, ZombieKind.WALKER, 2, 0);
        assertFalse(walker.isEnraged(now));
        run(1_200);
        assertTrue(walker.isEnraged(now), "el grito lo enfurecio");
        assertTrue(zombies.get("griton").toState().enraged(), "el griton tambien");
    }

    @Test
    @DisplayName("atacar hace ruido")
    void attackingMakesNoise() {
        assertFalse(player.isNoisy(now));
        session.attemptAttack("SEGURIDAD", AttackType.BASIC, player.getX(), player.getY(), 0);
        assertTrue(player.isNoisy(System.currentTimeMillis()));
    }
}
