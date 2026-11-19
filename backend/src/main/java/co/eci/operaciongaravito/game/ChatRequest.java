package co.eci.operaciongaravito.game;

/**
 * Chat rapido: {@code phrase} es una frase o un emote de la lista fija (ver
 * {@link GameSession#CHAT_PHRASES} y {@link GameSession#EMOTES}); no hay texto libre.
 */
public record ChatRequest(String playerId, String phrase) {
}
