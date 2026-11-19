package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ZombieAttackTest {

    private static final long T0 = 1_000_000;

    private Player player;
    private Zombie zombie;

    @BeforeEach
    void setUp() {
        player = new Player("SEGURIDAD");
        player.reportPosition(1, 500, 500);
        zombie = new Zombie("z1", 1, 470, 500, WaveCurve.ZOMBIE_BASE_HEALTH, 60);
    }

    @Test
    @DisplayName("al alcanzar al jugador se prepara en vez de morder al instante")
    void reachingThePlayerStartsAWindup() {
        assertFalse(zombie.updateAttack(player, T0));

        assertEquals(ZombieAttackPhase.WINDUP, zombie.getPhase());
        assertEquals(100, player.getHealth(), "la mordida no debe llegar en el mismo tick");
    }

    @Test
    @DisplayName("si el jugador sigue cerca al terminar la preparacion, la mordida conecta")
    void theBiteLandsAfterTheWindup() {
        zombie.updateAttack(player, T0);
        assertFalse(zombie.updateAttack(player, T0 + Zombie.WINDUP_MS - 1), "todavia se esta preparando");

        assertTrue(zombie.updateAttack(player, T0 + Zombie.WINDUP_MS));
        assertEquals(100 - Zombie.BITE_DAMAGE, player.getHealth());
        assertEquals(ZombieAttackPhase.STRIKE, zombie.getPhase());
    }

    @Test
    @DisplayName("alejarse durante la preparacion esquiva la mordida")
    void steppingAwayDodgesTheBite() {
        zombie.updateAttack(player, T0);
        player.reportPosition(1, 470 + Zombie.BITE_REACH_PX + 10, 500);

        assertFalse(zombie.updateAttack(player, T0 + Zombie.WINDUP_MS));
        assertEquals(100, player.getHealth());
        assertEquals(ZombieAttackPhase.STRIKE, zombie.getPhase(), "la mordida igual se gasta");
    }

    @Test
    @DisplayName("golpearlo mientras se prepara le corta la mordida y lo aturde")
    void hittingDuringTheWindupInterruptsIt() {
        zombie.updateAttack(player, T0);
        zombie.hit(1, 0, 0, T0 + 100);

        assertEquals(ZombieAttackPhase.STAGGER, zombie.getPhase());
        assertFalse(zombie.updateAttack(player, T0 + Zombie.WINDUP_MS));
        assertEquals(100, player.getHealth());

        assertFalse(zombie.updateAttack(player, T0 + 100 + Zombie.STAGGER_MS));
        assertEquals(ZombieAttackPhase.CHASE, zombie.getPhase(), "al pasar el aturdimiento vuelve a perseguir");
    }

    @Test
    @DisplayName("despues de morder se recupera antes de volver a atacar")
    void thereIsARecoveryBetweenBites() {
        long bite = T0 + Zombie.WINDUP_MS;
        zombie.updateAttack(player, T0);
        zombie.updateAttack(player, bite);

        assertFalse(zombie.updateAttack(player, bite + Zombie.STRIKE_RECOVER_MS - 1));
        assertEquals(ZombieAttackPhase.STRIKE, zombie.getPhase());

        zombie.updateAttack(player, bite + Zombie.STRIKE_RECOVER_MS);
        assertEquals(ZombieAttackPhase.CHASE, zombie.getPhase());
        zombie.updateAttack(player, bite + Zombie.STRIKE_RECOVER_MS + 1);
        assertEquals(ZombieAttackPhase.WINDUP, zombie.getPhase(), "puede volver a prepararse");
    }

    @Test
    @DisplayName("los zombis resistentes muerden mas fuerte pero se preparan mas")
    void toughZombiesHitHarderButSlower() {
        Zombie tough = new Zombie("z2", 1, 470, 500, WaveCurve.ZOMBIE_TOUGH_HEALTH, 60);
        tough.updateAttack(player, T0);

        assertFalse(tough.updateAttack(player, T0 + Zombie.WINDUP_MS));
        assertTrue(tough.updateAttack(player, T0 + Zombie.TOUGH_WINDUP_MS));
        assertEquals(100 - Zombie.TOUGH_BITE_DAMAGE, player.getHealth());
    }

    @Test
    @DisplayName("dos mordidas casi simultaneas de zombis distintos solo cuentan una")
    void bitesFromAHordeRespectTheGraceWindow() {
        Zombie other = new Zombie("z3", 1, 530, 500, WaveCurve.ZOMBIE_BASE_HEALTH, 60);
        zombie.updateAttack(player, T0);
        other.updateAttack(player, T0 + 50);

        assertTrue(zombie.updateAttack(player, T0 + Zombie.WINDUP_MS));
        assertFalse(other.updateAttack(player, T0 + 50 + Zombie.WINDUP_MS), "cae dentro de la ventana de gracia");
        assertEquals(100 - Zombie.BITE_DAMAGE, player.getHealth());

        assertTrue(player.takeBite(1, T0 + Zombie.WINDUP_MS + Player.BITE_GRACE_MS),
                "pasada la ventana vuelve a recibir dano");
    }

    @Test
    @DisplayName("un jugador en mision (invulnerable) no recibe la mordida")
    void invulnerablePlayersAreNotBitten() {
        player.setInvulnerable(true);
        zombie.updateAttack(player, T0);

        assertFalse(zombie.updateAttack(player, T0 + Zombie.WINDUP_MS));
        assertEquals(100, player.getHealth());
    }

    @Test
    @DisplayName("el estado que viaja al cliente incluye la fase del ataque")
    void stateCarriesThePhase() {
        assertEquals(ZombieAttackPhase.CHASE, zombie.toState().phase());
        zombie.updateAttack(player, T0);
        assertEquals(ZombieAttackPhase.WINDUP, zombie.toState().phase());
    }
}
