package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GameSessionZombieTest {

    private ScheduledExecutorService scheduler;
    private GameSession session;
    private Player player;

    @BeforeEach
    void setUp() {
        scheduler = Executors.newScheduledThreadPool(1);
        session = new GameSession("test", Building.F, scheduler, round -> { });
        assertNull(session.joinPlayer("SEGURIDAD"));
        assertTrue(session.start("SEGURIDAD"));
        player = session.getOrCreatePlayer("SEGURIDAD");
        player.reportPosition(2, 800, 736);
    }

    @AfterEach
    void tearDown() {
        scheduler.shutdownNow();
    }

    private void armPlayer() {
        player.tryAddItem(new InventorySlot(ItemType.WEAPON, "shop-hacha", "Hacha"));
    }

    private void tickUntilZombies() {
        long now = System.currentTimeMillis();
        // 45 s de preparacion antes del Kinder 1 = ~680 ticks de 66 ms.
        for (int i = 0; i < 1500 && session.zombieStates().isEmpty(); i++) {
            now += 66;
            session.tick(now, 0.066);
        }
        assertFalse(session.zombieStates().isEmpty(), "no llego a spawnear ningun zombi");
    }

    @Test
    @DisplayName("sin arma igual se puede pegar: el juego nunca queda sin salida")
    void unarmedPlayersCanStillFight() {
        AttackResult result = session.attemptAttack("SEGURIDAD", AttackType.BASIC, 800, 736, 0);
        assertTrue(result.success(), "desarmado debe poder golpear, solo que mas debil");
    }

    @Test
    @DisplayName("desarmado golpea pero no mata de un solo golpe")
    void unarmedTakesMoreThanOneHit() {
        tickUntilZombies();
        ZombieState target = session.zombieStates().get(0);

        AttackResult unarmed = session.attemptAttack("SEGURIDAD", AttackType.BASIC, target.x() - 20, target.y(), 0);

        assertEquals(1, unarmed.hits(), "el golpe deberia conectar");
        assertEquals(0, unarmed.kills(), "desarmado no deberia matar de un golpe");

    }

    @Test
    @DisplayName("el cooldown del golpe lo impone el servidor")
    void attackCooldownIsServerSide() {
        armPlayer();
        assertTrue(session.attemptAttack("SEGURIDAD", AttackType.BASIC, 800, 736, 0).success());

        AttackResult immediate = session.attemptAttack("SEGURIDAD", AttackType.BASIC, 800, 736, 0);
        assertFalse(immediate.success(), "dos golpes seguidos no deberian pasar");
        assertEquals("on_cooldown", immediate.reason());
    }

    @Test
    @DisplayName("matar un zombi paga exactamente un Garavito")
    void killingAZombiePaysOneGaravito() {
        armPlayer();
        tickUntilZombies();

        ZombieState target = session.zombieStates().get(0);
        player.reportPosition(target.x() - 20, target.y());

        int before = player.getGaravitos();
        AttackResult result = session.attemptAttack("SEGURIDAD", AttackType.BASIC, target.x() - 20, target.y(), 0);

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

        player.reportPosition(target.x() - 20, target.y());
        AttackResult result = session.attemptAttack("SEGURIDAD", AttackType.BASIC, target.x() - 20, target.y(), Math.PI);

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
        AttackResult result = session.attemptAttack("SEGURIDAD", AttackType.BASIC, target.x() - 400, target.y(), 0);

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

        long now = System.currentTimeMillis();
        session.tick(now, 0.066);

        assertTrue(session.zombieStates().isEmpty(), "la oleada deberia haberse limpiado");
        assertTrue(player.isAlive(), "el equipo deberia haberse levantado");
        assertTrue(player.getHealth() > 0);
        assertTrue(session.waveState().restingSeconds() > 0, "deberia haber entrado al respiro");
    }

    /** Registra kills en el director como si hubieran llegado por /attack. */
    private void registerKills(int count) {
        try {
            java.lang.reflect.Field field = GameSession.class.getDeclaredField("waveDirector");
            field.setAccessible(true);
            ((WaveDirector) field.get(session)).onZombiesKilled(count);
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
    }

    private long tickUntilKinder(long now, int kinder) {
        for (int i = 0; i < 2000 && session.waveState().number() < kinder; i++) {
            now += 66;
            session.tick(now, 0.066);
        }
        assertEquals(kinder, session.waveState().number());
        return now;
    }

    @Test
    @DisplayName("cumplir la cuota pasa al siguiente Kinder y retira la horda")
    void meetingTheQuotaClearsTheKinder() {
        long now = tickUntilKinder(System.currentTimeMillis(), 1);
        for (int i = 0; i < 100; i++) {
            now += 66;
            session.tick(now, 0.066);
        }
        assertFalse(session.zombieStates().isEmpty());

        registerKills(WaveCurve.blueprint(1).killQuota());
        now += 66;
        session.tick(now, 0.066);

        assertTrue(session.zombieStates().isEmpty(), "la horda deberia retirarse al pasar el Kinder");
        assertTrue(session.waveState().restingSeconds() > 0, "deberia empezar el respiro");
        tickUntilKinder(now, 2);
    }

    @Test
    @DisplayName("morir cuesta la corrida: desde el Kinder 2 se vuelve al Kinder 1")
    void wipeResetsTheRun() {
        long now = tickUntilKinder(System.currentTimeMillis(), 1);
        registerKills(WaveCurve.blueprint(1).killQuota());
        now = tickUntilKinder(now, 2);

        for (int i = 0; i < 10; i++) {
            player.takeDamage(10);
        }
        now += 66;
        session.tick(now, 0.066);

        assertTrue(session.consumeWipedRun(), "deberia avisarse el wipe");
        assertEquals(0, session.waveState().number());
        tickUntilKinder(now, 1);
    }

    @Test
    @DisplayName("ganar el Kinder 5 avisa la victoria una sola vez")
    void winningTheLastKinderAnnouncesVictory() {
        long now = System.currentTimeMillis();
        for (int k = 1; k <= WaveCurve.KINDER_COUNT; k++) {
            now = tickUntilKinder(now, k);
            registerKills(WaveCurve.blueprint(k).killQuota());
            now += 66;
            session.tick(now, 0.066);
        }
        assertTrue(session.waveState().victory());
        assertTrue(session.consumeVictory());
        assertFalse(session.consumeVictory());
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
        assertEquals("downed", session.attemptAttack("SEGURIDAD", AttackType.BASIC, 800, 736, 0).reason());
    }

    @Test
    @DisplayName("el ataque cargado pega en area y tiene enfriamiento propio")
    void chargedAttackHitsAllAroundAndCoolsDown() {
        tickUntilZombies();
        ZombieState target = session.zombieStates().get(0);
        player.reportPosition(target.x() - 20, target.y());

        AttackResult charged = session.attemptAttack("SEGURIDAD", AttackType.CHARGED, target.x() - 20, target.y(), Math.PI);
        assertTrue(charged.success());
        assertEquals(1, charged.hits(), "el ataque cargado no depende de hacia donde se mira");
        assertEquals(1, charged.kills(), "el ataque cargado mata a un zombi normal");

        AttackResult again = session.attemptAttack("SEGURIDAD", AttackType.CHARGED, target.x(), target.y(), 0);
        assertEquals("on_cooldown", again.reason());
        assertTrue(session.attemptAttack("SEGURIDAD", AttackType.BASIC, target.x(), target.y(), 0).success(),
                "el basico no comparte enfriamiento con el cargado");
    }

    @Test
    @DisplayName("la comida se guarda en el inventario y solo cura al usarla")
    void foodHealsOnlyWhenUsed() {
        player.takeDamage(40);
        player.reportPosition(1, 1632, 1248);
        assertTrue(session.attemptPickup("SEGURIDAD", "cafeteria-food-1", 1632, 1248).success());

        assertEquals(60, player.getHealth(), "recoger comida no debe curar");
        assertEquals(1, player.inventorySnapshot().size());

        assertTrue(session.attemptUseItem("SEGURIDAD", "cafeteria-food-1").success());
        assertEquals(75, player.getHealth());
        assertTrue(player.inventorySnapshot().isEmpty(), "usar la comida la gasta");
        assertEquals("not_usable", session.attemptUseItem("SEGURIDAD", "cafeteria-food-1").reason());
    }

    @Test
    @DisplayName("no se puede recoger un item de otro piso")
    void itemsFromOtherFloorsAreOutOfReach() {
        player.reportPosition(2, 1632, 1248);
        assertFalse(session.attemptPickup("SEGURIDAD", "cafeteria-food-1", 1632, 1248).success());
    }

    @Test
    @DisplayName("los zombis aparecen en el piso donde esta el jugador y no lo persiguen desde otro")
    void zombiesFollowThePlayersFloor() {
        player.reportPosition(3, 800, 736);
        tickUntilZombies();

        assertTrue(session.zombieStates().stream().allMatch(z -> z.floor() == 3));
    }

    @Test
    @DisplayName("un rol no se puede repetir en la misma sala y solo el anfitrion inicia")
    void lobbyRulesAreEnforced() {
        assertEquals("role_taken", session.joinPlayer("SEGURIDAD"));
        assertEquals("invalid_role", session.joinPlayer("MAGO"));
        assertNull(session.joinPlayer("SALUD"));

        assertFalse(session.start("SALUD"), "solo el anfitrion puede iniciar");
        assertEquals("SEGURIDAD", session.lobbyState().host());

        session.removePlayer("SEGURIDAD");
        assertEquals("SALUD", session.lobbyState().host(), "el anfitrion pasa al siguiente jugador");
    }

    @Test
    @DisplayName("mientras la sala no inicia no hay zombis")
    void nothingSpawnsBeforeStart() {
        GameSession waiting = new GameSession("wait", Building.F, scheduler, round -> { });
        waiting.joinPlayer("SEGURIDAD");
        long now = System.currentTimeMillis();
        for (int i = 0; i < 400; i++) {
            now += 66;
            waiting.tick(now, 0.066);
        }
        assertTrue(waiting.zombieStates().isEmpty());
    }

    @Test
    @DisplayName("los zombis aparecen de todos lados, tambien en el piso 1")
    void zombiesAlsoSpawnOnTheGroundFloor() {
        player.reportPosition(1, 800, 736);
        tickUntilZombies();

        assertTrue(session.zombieStates().stream().allMatch(z -> z.floor() == 1),
                "con el jugador en el piso 1, la horda aparece en el piso 1");
    }

    @Test
    @DisplayName("en el Edificio C (2 pisos) nunca aparece un zombi en un piso inexistente")
    void buildingCNeverSpawnsOnAMissingFloor() {
        GameSession c = new GameSession("edc", Building.C, scheduler, round -> { });
        c.joinPlayer("SEGURIDAD");
        c.start("SEGURIDAD");
        // Antes el director sorteaba el piso 3 aunque el C no lo tiene: un zombi
        // inalcanzable que dejaba la oleada sin poder terminar.
        c.getOrCreatePlayer("SEGURIDAD").reportPosition(1, 608, 800);
        long now = System.currentTimeMillis();
        for (int i = 0; i < 3000; i++) {
            now += 66;
            c.tick(now, 0.066);
        }
        assertFalse(c.zombieStates().isEmpty(), "no llego a spawnear ningun zombi");
        assertTrue(c.zombieStates().stream().allMatch(z -> Building.C.hasFloor(z.floor())),
                "aparecio un zombi en un piso que el Edificio C no tiene");
    }
}
