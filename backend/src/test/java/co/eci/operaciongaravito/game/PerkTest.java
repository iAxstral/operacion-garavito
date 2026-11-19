package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PerkTest {

    private GameSession session;
    private Player player;

    @BeforeEach
    void setUp() {
        session = new GameSession("MEJO", Building.F, BossConfig.defaults());
        session.joinPlayer("SEGURIDAD");
        session.start("SEGURIDAD");
        player = session.getOrCreatePlayer("SEGURIDAD");
    }

    private Perk offerAndPick(Perk wanted) {
        Random random = new Random(1);
        for (int i = 0; i < 200; i++) {
            player.offerPerks(random);
            if (player.perkOfferNames().contains(wanted.name())) {
                assertTrue(session.attemptChoosePerk("SEGURIDAD", wanted.name()).success());
                return wanted;
            }
        }
        throw new AssertionError("nunca se ofrecio " + wanted);
    }

    @Test
    @DisplayName("se ofrecen tres mejoras distintas que el jugador no tiene")
    void offersThreeNew() {
        player.offerPerks(new Random(7));
        assertEquals(Perk.OFFER_SIZE, new HashSet<>(player.perkOfferNames()).size());
        String first = player.perkOfferNames().get(0);
        session.attemptChoosePerk("SEGURIDAD", first);
        assertTrue(player.perkOfferNames().isEmpty(), "al elegir se cierra la oferta");
        for (int i = 0; i < 30; i++) {
            player.offerPerks(new Random(i));
            assertFalse(player.perkOfferNames().contains(first), "no vuelve a ofrecer la que ya tiene");
        }
    }

    @Test
    @DisplayName("no se puede elegir una mejora que no se ofrecio")
    void rejectsNotOffered() {
        assertEquals("not_offered", session.attemptChoosePerk("SEGURIDAD", "REFUERZO").reason());
        assertEquals("invalid_perk", session.attemptChoosePerk("SEGURIDAD", "VOLAR").reason());
        assertTrue(player.perkNames().isEmpty());
    }

    @Test
    @DisplayName("refuerzo cura y municion suma balas de reserva")
    void instantEffects() {
        player.takeDamage(60);
        offerAndPick(Perk.REFUERZO);
        assertEquals(80, player.getHealth());
    }

    @Test
    @DisplayName("piel dura quita 1 a cada mordida")
    void toughSkin() {
        offerAndPick(Perk.PIEL_DURA);
        player.takeBite(5, System.currentTimeMillis());
        assertEquals(96, player.getHealth());
    }

    @Test
    @DisplayName("regeneracion cura de a poco si no recibe daño")
    void regeneration() {
        offerAndPick(Perk.REGENERACION);
        player.takeDamage(10);
        long now = System.currentTimeMillis();
        player.regenerate(now + 1_000);
        assertEquals(90, player.getHealth(), "todavia no pasaron 5 s");
        player.regenerate(now + 6_000);
        assertEquals(91, player.getHealth());
        player.regenerate(now + 7_000);
        assertEquals(91, player.getHealth(), "una cada 3 s");
        player.regenerate(now + 9_100);
        assertEquals(92, player.getHealth());
    }

    @Test
    @DisplayName("las mejoras se pierden al empezar otra corrida")
    void resetClearsPerks() {
        offerAndPick(Perk.GOLPE_FUERTE);
        assertTrue(player.hasPerk(Perk.GOLPE_FUERTE));
        player.reset();
        assertFalse(player.hasPerk(Perk.GOLPE_FUERTE));
    }
}
