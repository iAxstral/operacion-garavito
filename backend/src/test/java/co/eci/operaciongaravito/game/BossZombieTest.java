package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Transiciones de la IA del jefe sobre el piso 1 real del Edificio F, con reloj
 * controlado. Vestibulo: filas 10-13 libres de punta a punta (y = 736 es la fila 11).
 * Aula F-104: columnas 7-12, filas 2-6, con salida por la puerta de la columna 9.
 */
class BossZombieTest {

    private static final long T0 = 1_000_000L;
    private static final double DT = 0.066;
    private static final long TICK_MS = 66;
    private static final double HUB_Y = 736;

    private final BossConfig config = BossConfig.defaults();
    private FloorGrid floor;
    private long now;

    @BeforeEach
    void setUp() {
        floor = FloorGrid.forFloor(Building.F, 1);
        now = T0;
    }

    private BossZombie bossAt(double x, double y) {
        return new BossZombie("boss", 1, x, y, config, new Random(42));
    }

    private static Player playerAt(double x, double y) {
        Player player = new Player("SEGURIDAD");
        player.reportPosition(1, x, y);
        return player;
    }

    private void tick(BossZombie boss, List<Player> players, int ticks) {
        for (int i = 0; i < ticks; i++) {
            now += TICK_MS;
            boss.update(now, DT, floor, players);
        }
    }

    @Test
    @DisplayName("arranca patrullando")
    void startsPatrolling() {
        assertEquals(BossState.PATRULLA, bossAt(672, HUB_Y).getState());
    }

    @Test
    @DisplayName("PATRULLA → ALERTA al ver a un jugador a menos de 8 tiles")
    void patrolToAlertWhenAPlayerIsInSight() {
        BossZombie boss = bossAt(672, HUB_Y);
        Player player = playerAt(672 + 6 * 64, HUB_Y); // 6 tiles, mismo pasillo
        tick(boss, List.of(player), 1);
        assertEquals(BossState.ALERTA, boss.getState());
    }

    @Test
    @DisplayName("no reacciona a un jugador mas lejos que el radio de deteccion")
    void ignoresPlayersBeyondTheDetectionRadius() {
        BossZombie boss = bossAt(160, HUB_Y);
        Player player = playerAt(160 + 20 * 64, HUB_Y); // 20 tiles
        tick(boss, List.of(player), 5);
        assertEquals(BossState.PATRULLA, boss.getState());
    }

    @Test
    @DisplayName("una pared en medio corta la vision aunque este cerca")
    void wallsBlockTheLineOfSight() {
        BossZombie boss = bossAt(672, 288);              // dentro del aula (col 10, fila 4)
        Player player = playerAt(800, HUB_Y);            // vestibulo, ~7 tiles, detras de la pared
        assertFalse(floor.hasLineOfSight(672, 288, 800, HUB_Y));
        tick(boss, List.of(player), 1);
        assertEquals(BossState.PATRULLA, boss.getState());
    }

    @Test
    @DisplayName("ALERTA → PERSECUCION al terminar el aviso, y se acerca al jugador")
    void alertThenChase() {
        BossZombie boss = bossAt(672, HUB_Y);
        Player player = playerAt(672 + 6 * 64, HUB_Y);
        tick(boss, List.of(player), 1);
        assertEquals(BossState.ALERTA, boss.getState());

        int alertTicks = (int) (config.alertMs() / TICK_MS) + 1;
        tick(boss, List.of(player), alertTicks);
        assertEquals(BossState.PERSECUCION, boss.getState());

        double before = Math.abs(player.getX() - boss.getX());
        tick(boss, List.of(player), 10);
        assertTrue(Math.abs(player.getX() - boss.getX()) < before, "deberia acercarse");
    }

    @Test
    @DisplayName("PERSECUCION → ATAQUE a 1 tile, y muerde con cooldown")
    void chaseToAttackAndBite() {
        BossZombie boss = bossAt(672, HUB_Y);
        Player player = playerAt(672 + 3 * 64, HUB_Y);
        for (int i = 0; i < 200 && boss.getState() != BossState.ATAQUE; i++) {
            tick(boss, List.of(player), 1);
        }
        assertEquals(BossState.ATAQUE, boss.getState());

        tick(boss, List.of(player), 1);
        assertEquals(100 - config.biteDamage(), player.getHealth(), "primera mordida");
        tick(boss, List.of(player), 2);
        assertEquals(100 - config.biteDamage(), player.getHealth(), "el cooldown impide morder cada tick");
        tick(boss, List.of(player), (int) (config.attackCooldownMs() / TICK_MS) + 1);
        assertEquals(100 - 2 * config.biteDamage(), player.getHealth(), "segunda mordida tras el cooldown");
    }

    @Test
    @DisplayName("ATAQUE → PERSECUCION si el jugador se aleja")
    void attackBackToChaseWhenThePlayerEscapes() {
        BossZombie boss = bossAt(672, HUB_Y);
        Player player = playerAt(672 + 40, HUB_Y);
        for (int i = 0; i < 30 && boss.getState() != BossState.ATAQUE; i++) {
            tick(boss, List.of(player), 1);
        }
        assertEquals(BossState.ATAQUE, boss.getState());

        player.reportPosition(1, 672 + 5 * 64, HUB_Y);
        tick(boss, List.of(player), 1);
        assertEquals(BossState.PERSECUCION, boss.getState());
    }

    @Test
    @DisplayName("un golpe cargado lo aturde desde cualquier estado y luego vuelve a perseguir")
    void chargedHitStuns() {
        BossZombie boss = bossAt(672, HUB_Y);
        Player player = playerAt(672 + 3 * 64, HUB_Y);
        tick(boss, List.of(player), 1);
        assertEquals(BossState.ALERTA, boss.getState());

        assertFalse(boss.hit(4, true, now));
        assertEquals(BossState.ATURDIDO, boss.getState());
        double x = boss.getX();
        tick(boss, List.of(player), 5);
        assertEquals(BossState.ATURDIDO, boss.getState());
        assertEquals(x, boss.getX(), "aturdido no se mueve");

        tick(boss, List.of(player), (int) (config.stunMs() / TICK_MS) + 1);
        assertEquals(BossState.PERSECUCION, boss.getState());
    }

    @Test
    @DisplayName("un golpe normal hace daño pero no aturde")
    void basicHitDoesNotStun() {
        BossZombie boss = bossAt(672, HUB_Y);
        assertFalse(boss.hit(2, false, now));
        assertEquals(config.maxHealth() - 2, boss.getHealth());
        assertEquals(BossState.PATRULLA, boss.getState());
    }

    @Test
    @DisplayName("solo el golpe que lo mata devuelve true")
    void onlyTheKillingBlowCounts() {
        BossZombie boss = bossAt(672, HUB_Y);
        assertFalse(boss.hit(config.maxHealth() - 1, false, now));
        assertTrue(boss.hit(5, false, now));
        assertFalse(boss.isAlive());
        assertFalse(boss.hit(5, false, now), "un jefe muerto no se vuelve a matar");
    }

    @Test
    @DisplayName("recalcula el camino cada ~500 ms, no en cada tick")
    void repathIsThrottled() {
        BossZombie boss = bossAt(160, HUB_Y);
        Player player = playerAt(160 + 7 * 64, HUB_Y);
        tick(boss, List.of(player), (int) (config.alertMs() / TICK_MS) + 2);
        assertEquals(BossState.PERSECUCION, boss.getState());

        int before = boss.pathComputations();
        int ticks = 45; // ~3 s a 15 Hz
        for (int i = 0; i < ticks; i++) {
            // El jugador retrocede para que la persecucion siga durante todo el tramo.
            player.reportPosition(1, Math.min(2400, player.getX() + 4), HUB_Y);
            tick(boss, List.of(player), 1);
        }
        int computations = boss.pathComputations() - before;
        assertTrue(computations <= 10, "demasiados recalculos: " + computations + " en " + ticks + " ticks");
        assertTrue(computations >= 4, "deberia recalcular periodicamente: " + computations);
    }

    @Test
    @DisplayName("si pierde de vista al jugador por un rato, vuelve a patrullar")
    void losesTheTargetAndPatrolsAgain() {
        BossZombie boss = bossAt(672, HUB_Y);
        Player player = playerAt(672 + 6 * 64, HUB_Y);
        tick(boss, List.of(player), (int) (config.alertMs() / TICK_MS) + 2);
        assertEquals(BossState.PERSECUCION, boss.getState());

        tick(boss, List.of(), (int) (config.loseTargetMs() / TICK_MS) + 2);
        assertEquals(BossState.PATRULLA, boss.getState());
    }

    @Test
    @DisplayName("recuerda donde lo vio: sigue persiguiendo aunque el jugador salga de su vista")
    void remembersTheLastSeenPosition() {
        BossZombie boss = bossAt(672, HUB_Y);
        Player player = playerAt(672 + 6 * 64, HUB_Y);
        tick(boss, List.of(player), (int) (config.alertMs() / TICK_MS) + 2);
        assertEquals(BossState.PERSECUCION, boss.getState());

        // El jugador se mete al aula por la puerta de la columna 9: sin linea de vision.
        player.reportPosition(1, 736, 288);
        double before = Math.hypot(boss.getX() - 736, boss.getY() - 288);
        tick(boss, List.of(player), 10);
        assertEquals(BossState.PERSECUCION, boss.getState(), "no deberia rendirse enseguida");
        assertTrue(Math.hypot(boss.getX() - 736, boss.getY() - 288) < before, "sigue yendo hacia alla");
    }

    @Test
    @DisplayName("nunca atraviesa paredes mientras persigue")
    void neverEndsInsideAWall() {
        BossZombie boss = bossAt(160, HUB_Y);
        Player player = playerAt(160 + 5 * 64, HUB_Y);
        for (int i = 0; i < 300; i++) {
            if (i == 60) {
                player.reportPosition(1, 736, 288); // al aula, para forzar el camino por la puerta
            }
            tick(boss, List.of(player), 1);
            assertTrue(floor.isWalkable(boss.getX(), boss.getY()), "el jefe quedo dentro de una pared");
        }
    }
}
