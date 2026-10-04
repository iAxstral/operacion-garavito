package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WeaponTest {

    private static final int FLOOR = 2;

    private GameSession session;
    private Player player;
    private Map<String, Zombie> zombies;
    /** Inicio (x, y) de un tramo horizontal libre de al menos 720 px en el piso de prueba. */
    private double[] corridor;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws ReflectiveOperationException {
        session = new GameSession("armas", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD");
        session.start("SEGURIDAD");
        player = session.getOrCreatePlayer("SEGURIDAD");
        corridor = findCorridor(FloorGrid.forFloor(Building.F, FLOOR), 720);
        player.reportPosition(FLOOR, corridor[0], corridor[1]);

        java.lang.reflect.Field field = GameSession.class.getDeclaredField("zombies");
        field.setAccessible(true);
        zombies = (Map<String, Zombie>) field.get(session);
        zombies.clear();
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
        throw new AssertionError("el piso no tiene un pasillo recto de " + length + " px");
    }

    private Zombie zombieAt(String id, double dx, int health) {
        Zombie zombie = new Zombie(id, FLOOR, corridor[0] + dx, corridor[1], health, 0);
        zombies.put(id, zombie);
        return zombie;
    }

    private void give(String itemId, String name) {
        assertTrue(player.tryAddItem(new InventorySlot(ItemType.WEAPON, itemId, name)));
        assertTrue(session.attemptEquip("SEGURIDAD", itemId).success());
    }

    private AttackResult fire() {
        return session.attemptAttack("SEGURIDAD", AttackType.BASIC, corridor[0], corridor[1], 0);
    }

    private void waitCooldown() throws InterruptedException {
        Thread.sleep(Weapon.RIFLE.cooldownMs() + 20);
    }

    @Test
    @DisplayName("no se puede equipar un arma que no se tiene")
    void cannotEquipWhatYouDoNotOwn() {
        assertEquals("not_owned", session.attemptEquip("SEGURIDAD", "shop-rifle").reason());
        assertEquals(Weapon.FISTS, player.getEquipped());
    }

    @Test
    @DisplayName("la pistola alcanza a un zombi lejano que los puños no tocarian")
    void pistolHitsFromAfar() {
        give("shop-pistola", "Pistola");
        zombieAt("lejos", 300, WaveCurve.ZOMBIE_BASE_HEALTH);

        AttackResult result = fire();

        assertTrue(result.success());
        assertEquals(1, result.kills(), "2 de dano mata a un zombi comun");
        assertEquals(Weapon.PISTOL.magazineSize() - 1, player.magazine(Weapon.PISTOL), "gasto una bala");
    }

    @Test
    @DisplayName("una bala de pistola se queda en el primer zombi; la del rifle atraviesa")
    void rifleBulletsPierce() throws InterruptedException {
        give("shop-pistola", "Pistola");
        zombieAt("a", 150, 10);
        zombieAt("b", 250, 10);
        assertEquals(1, fire().hits());

        waitCooldown();
        give("shop-rifle", "Rifle");
        assertEquals(2, fire().hits(), "el rifle atraviesa a los dos");
    }

    @Test
    @DisplayName("disparar hacia otro lado no alcanza al zombi")
    void aimMatters() {
        give("shop-pistola", "Pistola");
        zombieAt("z", 200, WaveCurve.ZOMBIE_BASE_HEALTH);

        AttackResult result = session.attemptAttack("SEGURIDAD", AttackType.BASIC, corridor[0], corridor[1], Math.PI);
        assertTrue(result.success());
        assertEquals(0, result.hits());
    }

    @Test
    @DisplayName("una pared detiene la bala")
    void wallsStopBullets() {
        give("shop-rifle", "Rifle");
        FloorGrid grid = FloorGrid.forFloor(Building.F, FLOOR);
        // Desde el pasillo hacia arriba, hasta la primera pared, y un zombi detras de ella.
        double wallY = corridor[1];
        while (grid.isWalkable(corridor[0], wallY)) {
            wallY -= 8;
        }
        Zombie behind = new Zombie("tras-pared", FLOOR, corridor[0], wallY - 40, 10, 0);
        zombies.put(behind.getId(), behind);

        AttackResult result = session.attemptAttack("SEGURIDAD", AttackType.BASIC, corridor[0], corridor[1], -Math.PI / 2);
        assertEquals(0, result.hits());
    }

    @Test
    @DisplayName("sin balas no dispara; con reserva recarga y vuelve a disparar")
    void magazineAndReload() throws InterruptedException {
        give("shop-pistola", "Pistola");
        for (int i = 0; i < Weapon.PISTOL.magazineSize(); i++) {
            assertTrue(fire().success(), "bala " + (i + 1));
            Thread.sleep(Weapon.PISTOL.cooldownMs() + 5);
        }
        assertEquals("no_ammo", fire().reason(), "cargador vacio y sin reserva");

        player.addAmmo(Player.AMMO_PER_PACK);
        Thread.sleep(Weapon.PISTOL.cooldownMs() + 5);
        assertEquals("reloading", fire().reason(), "con reserva empieza a recargar solo");
        assertTrue(player.reloadingInMs(System.currentTimeMillis()) > 0);

        Thread.sleep(Weapon.PISTOL.reloadMs() + 20);
        assertEquals(Weapon.PISTOL.magazineSize(), player.magazine(Weapon.PISTOL));
        assertEquals(Player.AMMO_PER_PACK - Weapon.PISTOL.magazineSize(), player.getReserveAmmo());
        assertTrue(fire().success());
    }

    @Test
    @DisplayName("la municion se suma a la reserva y no ocupa espacio en el inventario")
    void ammoDoesNotUseASlot() {
        player.addGaravitos(100);
        PurchaseResult result = player.purchase(8, new InventorySlot(ItemType.AMMO, "shop-municion", "Municion"));

        assertTrue(result.success());
        assertEquals(Player.AMMO_PER_PACK, player.getReserveAmmo());
        assertTrue(player.inventorySnapshot().isEmpty());
    }

    @Test
    @DisplayName("el hacha mata a un zombi comun de un golpe y los puños no")
    void axeBeatsFists() throws InterruptedException {
        zombieAt("z", 30, WaveCurve.ZOMBIE_BASE_HEALTH);
        assertEquals(0, fire().kills(), "un puñetazo no lo mata");

        Thread.sleep(Weapon.FISTS.cooldownMs() + 5);
        give("shop-hacha", "Hacha");
        assertEquals(1, fire().kills());
    }

    @Test
    @DisplayName("los disparos se cuentan para que los demas los vean")
    void shotsAreCounted() {
        give("shop-pistola", "Pistola");
        int before = player.getShotSeq();
        fire();
        assertEquals(before + 1, player.getShotSeq());
        assertFalse(session.playerStates().isEmpty());
        assertEquals(Weapon.PISTOL, session.playerStates().get(0).weapon());
    }
}
