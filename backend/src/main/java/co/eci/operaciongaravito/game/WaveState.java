package co.eci.operaciongaravito.game;

/**
 * Vista publica de la oleada en curso. {@code restingSeconds} es 0 mientras
 * la oleada esta activa y cuenta atras durante el respiro entre oleadas.
 */
public record WaveState(int number, int remaining, int restingSeconds) {
}
