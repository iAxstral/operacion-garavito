package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class HideTest {

    private GameSession session;
    private Player guard;
    private HideSpots.Spot spot;

    @BeforeEach
    void setUp() {
        session = new GameSession("HIDE", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD", "t");
        session.joinPlayer("SALUD", "t");
        guard = session.getOrCreatePlayer("SEGURIDAD");
        spot = HideSpots.forBuilding(Building.F).stream().filter(s -> s.floor() == 1).findFirst().orElseThrow();
        guard.reportPosition(1, spot.x() + 20, spot.y());
    }

    @Test
    @DisplayName("cada edificio tiene armarios en celdas libres de sus pisos")
    void everyBuildingHasSpots() {
        for (Building building : Building.values()) {
            List<HideSpots.Spot> spots = HideSpots.forBuilding(building);
            assertFalse(spots.isEmpty(), building.name());
            spots.forEach(s -> assertTrue(FloorGrid.forFloor(building, s.floor()).isWalkable(s.x(), s.y()), s.id()));
        }
    }

    @Test
    @DisplayName("escondido no recibe daño ni puede atacar, y al salir espera para volver")
    void hidingProtectsAndHasCooldown() {
        assertTrue(session.attemptHide("SEGURIDAD", 1_000).success());
        assertEquals(spot.id(), session.playerStates().stream()
                .filter(p -> p.playerId().equals("SEGURIDAD")).findFirst().orElseThrow().hidingIn());
        assertFalse(guard.takeDamage(10));
        assertEquals(100, guard.getHealth());
        assertEquals("hidden", session.attemptAttack("SEGURIDAD", AttackType.BASIC, guard.getX(), guard.getY(), 0).reason());

        assertTrue(session.attemptHide("SEGURIDAD", 2_000).success(), "con E de nuevo sale");
        assertFalse(guard.isHidden());
        assertEquals("on_cooldown", session.attemptHide("SEGURIDAD", 3_000).reason());
        assertTrue(session.attemptHide("SEGURIDAD", 2_000 + GameSession.HIDE_COOLDOWN_MS).success());
    }

    @Test
    @DisplayName("el armario ocupado no se comparte y lejos no hay donde esconderse")
    void spotTakenAndOutOfReach() {
        Player medic = session.getOrCreatePlayer("SALUD");
        medic.reportPosition(1, spot.x() - 20, spot.y());
        assertTrue(session.attemptHide("SEGURIDAD", 1_000).success());
        assertEquals("spot_taken", session.attemptHide("SALUD", 1_000).reason());
        medic.reportPosition(1, spot.x() + 400, spot.y() + 400);
        PlayerActionResult far = session.attemptHide("SALUD", 1_000);
        assertNotNull(far.reason());
    }

    @Test
    @DisplayName("se sale solo al acabarse el tiempo")
    void expiresAfterMax() {
        assertTrue(session.attemptHide("SEGURIDAD", 1_000).success());
        assertFalse(guard.expireHide(1_000 + GameSession.HIDE_MAX_MS - 1, GameSession.HIDE_COOLDOWN_MS));
        assertTrue(guard.expireHide(1_000 + GameSession.HIDE_MAX_MS, GameSession.HIDE_COOLDOWN_MS));
        assertFalse(guard.isHidden());
    }
}
