package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Cubre las reglas de zombis que no se pueden comprobar a ojo jugando:
 * que la recompensa se pague una sola vez, que el cooldown no se pueda
 * saltear mandando mensajes mas rapido, y que morir cueste la corrida.
 */
class GameSessionZombieTest {

    private ScheduledExecutorService scheduler;
    private GameSession session;
    private Player player;

    @BeforeEach
    void setUp() {
        scheduler = Executors.newScheduledThreadPool(1);
        session = new GameSession("test", scheduler, round -> { });
        player = session.getOrCreatePlayer("SEGURIDAD");
        player.reportPosition(800, 736);
    }

    @AfterEach
    void tearDown() {
        scheduler.shutdownNow();
    }

    private void armPlayer() {
        player.tryAddItem(new InventorySlot(ItemType.WEAPON, "shop-hacha", "Hacha"));
    }

    /** Corre ticks hasta que haya al menos un zombi en el mapa. */
    private void tickUntilZombies() {
        long now = System.currentTimeMillis();
        for (int i = 0; i < 400 && session.zombieStates().isEmpty(); i++) {
            now += 66;
            session.tick(now, 0.066);
        }
        assertFalse(session.zombieStates().isEmpty(), "no llego a spawnear ningun zombi");
    }

    @Test
    @DisplayName("sin arma igual se puede pegar: el juego nunca queda sin salida")
    void unarmedPlayersCanStillFight() {
        AttackResult result = session.attemptAttack("SEGURIDAD", 800, 736, 0);
        assertTrue(result.success(), "desarmado debe poder golpear, solo que mas debil");
    }

    @Test
    @DisplayName("desarmado golpea pero no mata de un solo golpe")
    void unarmedTakesMoreThanOneHit() {
        tickUntilZombies();
        ZombieState target = session.zombieStates().get(0);

        AttackResult unarmed = session.attemptAttack("SEGURIDAD", target.x() - 20, target.y(), 0);

        assertEquals(1, unarmed.hits(), "el golpe deberia conectar");
        assertEquals(0, unarmed.kills(), "desarmado no deberia matar de un golpe");
        // El caso con hacha (mata de un golpe) lo cubre
        // killingAZombiePaysOneGaravito; aca no se puede encadenar el segundo
        // golpe porque el cooldown del servidor es en tiempo real.
    }

    @Test
    @DisplayName("el cooldown del golpe lo impone el servidor")
    void attackCooldownIsServerSide() {
        armPlayer();
        assertTrue(session.attemptAttack("SEGURIDAD", 800, 736, 0).success());

        AttackResult immediate = session.attemptAttack("SEGURIDAD", 800, 736, 0);
        assertFalse(immediate.success(), "dos golpes seguidos no deberian pasar");
        assertEquals("on_cooldown", immediate.reason());
    }

    @Test
    @DisplayName("matar un zombi paga exactamente un Garavito")
    void killingAZombiePaysOneGaravito() {
        armPlayer();
        tickUntilZombies();

        // Se pone al jugador encima de un zombi y se golpea en su direccion.
        ZombieState target = session.zombieStates().get(0);
        player.reportPosition(target.x() - 20, target.y());

        int before = player.getGaravitos();
        AttackResult result = session.attemptAttack("SEGURIDAD", target.x() - 20, target.y(), 0);

        assertTrue(result.success());
        assertEquals(1, result.kills(), "el hacha debe matar de un golpe a un zombi normal");
        assertEquals(before + 1, player.getGaravitos());
    }

    @Test
    @DisplayName("un golpe al aire no paga nada")
    void missingPaysNothing() {
        armPlayer();
        tickUntilZombies();

        ZombieState target = session.zombieStates().get(0);
        // Mismo punto, pero mirando exactamente al lado contrario.
        player.reportPosition(target.x() - 20, target.y());
        AttackResult result = session.attemptAttack("SEGURIDAD", target.x() - 20, target.y(), Math.PI);

        assertTrue(result.success());
        assertEquals(0, result.kills());
        assertEquals(0, player.getGaravitos());
    }

    @Test
    @DisplayName("un zombi fuera de alcance no recibe el golpe")
    void outOfRangeZombiesAreSafe() {
        armPlayer();
        tickUntilZombies();

        ZombieState target = session.zombieStates().get(0);
        AttackResult result = session.attemptAttack("SEGURIDAD", target.x() - 400, target.y(), 0);

        assertTrue(result.success());
        assertEquals(0, result.hits());
    }

    @Test
    @DisplayName("el hacha cuesta lo que paga una mision de rol")
    void axeCostsExactlyOneMissionReward() {
        ShopItem axe = ShopCatalog.itemById("shop-hacha");
        assertEquals(MissionCatalog.REWARD_GARAVITOS, axe.price());
        assertEquals(ItemType.WEAPON, axe.type());
    }

    @Test
    @DisplayName("si cae el equipo completo la partida no se congela")
    void teamWipeDoesNotFreezeTheGame() {
        tickUntilZombies();
        for (int i = 0; i < 10; i++) {
            player.takeDamage(10);
        }
        assertFalse(player.isAlive());

        // Un solo tick con todo el equipo caido tiene que limpiar la oleada y
        // levantar al equipo; sin eso los zombis se quedan sin objetivo, la
        // oleada nunca se limpia y nadie revive jamas.
        long now = System.currentTimeMillis();
        session.tick(now, 0.066);

        assertTrue(session.zombieStates().isEmpty(), "la oleada deberia haberse limpiado");
        assertTrue(player.isAlive(), "el equipo deberia haberse levantado");
        assertTrue(player.getHealth() > 0);
        assertTrue(session.waveState().restingSeconds() > 0, "deberia haber entrado al respiro");
    }

    @Test
    @DisplayName("morir cuesta la corrida: se vuelve a la oleada 1")
    void wipeResetsTheRun() {
        // Se avanza a mano hasta una oleada alta para que el reinicio se note.
        long now = System.currentTimeMillis();
        for (int i = 0; i < 4000 && session.waveState().number() < 3; i++) {
            now += 200;
            session.tick(now, 0.2);
            session.zombieStates().forEach(z -> { });
            // Matar todo lo que aparezca para que la oleada avance.
            armPlayer();
            session.attemptAttack("SEGURIDAD", player.getX(), player.getY(), 0);
        }

        for (int i = 0; i < 10; i++) {
            player.takeDamage(10);
        }
        now += 200;
        session.tick(now, 0.066);

        assertTrue(session.consumeWipedRun(), "deberia avisarse el wipe");
        // Tras el respiro, la corrida arranca de nuevo en la oleada 1.
        for (int i = 0; i < 400 && session.waveState().restingSeconds() > 0; i++) {
            now += 200;
            session.tick(now, 0.2);
        }
        assertEquals(1, session.waveState().number(), "el wipe debe costar el progreso");
    }

    @Test
    @DisplayName("un jugador caido deja de recibir daño y no puede atacar")
    void downedPlayersAreOutOfPlay() {
        armPlayer();
        for (int i = 0; i < 10; i++) {
            player.takeDamage(10);
        }

        assertEquals(0, player.getHealth());
        assertFalse(player.isAlive());
        assertFalse(player.takeDamage(10), "un jugador caido no deberia seguir recibiendo daño");
        assertEquals("downed", session.attemptAttack("SEGURIDAD", 800, 736, 0).reason());
    }
}
