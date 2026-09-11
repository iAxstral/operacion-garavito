package co.eci.operaciongaravito.game;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/** Registro en memoria de partidas activas, por gameId. */
@Service
public class GameSessionService {

    private final Map<String, GameSession> sessions = new ConcurrentHashMap<>();

    public GameSession getOrCreate(String gameId) {
        return sessions.computeIfAbsent(gameId, GameSession::new);
    }
}
