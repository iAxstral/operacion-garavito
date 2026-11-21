package co.eci.operaciongaravito.security;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Cuantas salas puede crear cada conexion y cada IP. El tope por nodo lo aplica
 * GameSessionService; aqui va lo que depende de quien pide.
 */
@Component
public class LimiteSalas {

    private final Map<String, AtomicInteger> porConexion = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> porIp = new ConcurrentHashMap<>();
    private final SecurityProperties properties;

    public LimiteSalas(SecurityProperties properties) {
        this.properties = properties;
    }

    /** True si esta conexion (y su IP) todavia pueden crear una sala; si si, la anota. */
    public boolean permitir(String sessionId, String ip) {
        SecurityProperties.Rooms rooms = properties.getRooms();
        AtomicInteger creadas = porConexion.computeIfAbsent(sessionId == null ? "?" : sessionId, id -> new AtomicInteger());
        if (creadas.get() >= rooms.getMaxPerConnection()) {
            return false;
        }
        long now = System.currentTimeMillis();
        Deque<Long> recientes = porIp.computeIfAbsent(ip == null ? "?" : ip, k -> new ArrayDeque<>());
        synchronized (recientes) {
            while (!recientes.isEmpty() && now - recientes.peekFirst() > rooms.getIpWindowMs()) {
                recientes.pollFirst();
            }
            if (recientes.size() >= rooms.getMaxPerIp()) {
                return false;
            }
            recientes.addLast(now);
        }
        creadas.incrementAndGet();
        return true;
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        porConexion.remove(event.getSessionId());
        long now = System.currentTimeMillis();
        porIp.values().removeIf(deque -> {
            synchronized (deque) {
                return deque.isEmpty() || now - deque.peekLast() > properties.getRooms().getIpWindowMs();
            }
        });
    }
}
