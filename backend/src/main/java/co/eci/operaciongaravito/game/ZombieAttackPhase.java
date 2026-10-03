package co.eci.operaciongaravito.game;

/**
 * Fases del ataque de un zombi comun. Viajan al cliente en {@link ZombieState} para
 * que pueda telegrafiar la mordida antes de que llegue.
 */
public enum ZombieAttackPhase {
    /** Persigue a su objetivo. */
    CHASE,
    /** Se prepara para morder: quieto, y la mordida se puede esquivar o cortar con un golpe. */
    WINDUP,
    /** Acaba de lanzar la mordida y se recupera (mas lento) antes de poder volver a atacar. */
    STRIKE,
    /** Un golpe lo interrumpio mientras se preparaba: queda aturdido un instante. */
    STAGGER
}
