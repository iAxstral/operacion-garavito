package co.eci.operaciongaravito.game;

/**
 * Vista de una ronda para el payload de broadcast. {@code resolved} es una
 * bandera "esto se acaba de resolver justo en este mensaje" — no persiste:
 * en broadcasts de join/pickup siempre va en false, aunque number/schoolState
 * reflejen la ultima ronda resuelta.
 */
public record RoundState(int number, SchoolStateView schoolState, boolean resolved) {
}
