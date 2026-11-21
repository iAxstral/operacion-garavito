package co.eci.operaciongaravito.security;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Portero del canal STOMP (clientInboundChannel): todo frame que manda un cliente pasa
 * por aqui antes de llegar al broker o a un @MessageMapping.
 * <ul>
 *   <li>SUBSCRIBE solo a {@code /topic/game/{codigo}} exacto (sin comodines) o a la cola
 *       privada {@code /user/queue/eventos}, y con un tope por conexion.</li>
 *   <li>SEND solo a {@code /app/game/...}: publicar directo en {@code /topic/...} le
 *       mandaria un estado falso a todos los jugadores de la sala.</li>
 *   <li>Token bucket por conexion: lo que pasa del ritmo permitido se descarta, y si
 *       sigue, se corta la conexion.</li>
 * </ul>
 * Un destino prohibido corta la conexion de inmediato: ningun cliente honesto lo manda.
 */
@Component
public class StompGuardInterceptor implements ChannelInterceptor {

    static final Pattern SALA = Pattern.compile("/topic/game/[A-Z0-9]{4,8}");
    static final String COLA_PRIVADA = "/user/queue/eventos";
    static final Pattern ENVIO = Pattern.compile("/app/game/(create|[A-Z0-9]{4,8}/[a-z]{2,16}(/[a-z]{2,16})?)");

    /** Estado por conexion: suscripciones abiertas, cubeta de tokens y faltas recientes. */
    static final class Conexion {
        final Map<String, String> suscripciones = new ConcurrentHashMap<>();
        double tokens;
        long ultimaRecarga;
        int faltas;
        long ventanaDesde;

        Conexion(double tokens, long now) {
            this.tokens = tokens;
            this.ultimaRecarga = now;
            this.ventanaDesde = now;
        }
    }

    private final Map<String, Conexion> conexiones = new ConcurrentHashMap<>();
    private final SecurityProperties properties;
    private final Rechazos rechazos;
    private final SesionesWebSocket sesiones;

    public StompGuardInterceptor(SecurityProperties properties, Rechazos rechazos, SesionesWebSocket sesiones) {
        this.properties = properties;
        this.rechazos = rechazos;
        this.sesiones = sesiones;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message; // latidos y mensajes internos
        }
        String sessionId = accessor.getSessionId();
        StompCommand command = accessor.getCommand();
        if (command == StompCommand.CONNECT || command == StompCommand.STOMP) {
            sesiones.marcarConectada(sessionId);
            conexiones.computeIfAbsent(sessionId, id -> nueva());
            return message;
        }
        if (command == StompCommand.DISCONNECT) {
            conexiones.remove(sessionId);
            return message;
        }
        if (command != StompCommand.SUBSCRIBE && command != StompCommand.UNSUBSCRIBE && command != StompCommand.SEND) {
            return message;
        }

        Conexion conexion = conexiones.computeIfAbsent(sessionId, id -> nueva());
        if (!consumir(conexion, sessionId)) {
            return null;
        }
        String destination = accessor.getDestination();
        switch (command) {
            case SUBSCRIBE -> {
                if (destination == null || !(SALA.matcher(destination).matches() || COLA_PRIVADA.equals(destination))) {
                    return cortar(sessionId, Rechazos.BAD_SUBSCRIBE, "suscripcion no permitida");
                }
                String id = accessor.getSubscriptionId();
                if (id == null || id.length() > 64) {
                    return cortar(sessionId, Rechazos.BAD_SUBSCRIBE, "suscripcion sin id");
                }
                if (!conexion.suscripciones.containsKey(id)
                        && conexion.suscripciones.size() >= properties.getStomp().getMaxSubscriptions()) {
                    return cortar(sessionId, Rechazos.BAD_SUBSCRIBE, "demasiadas suscripciones");
                }
                conexion.suscripciones.put(id, destination);
            }
            case UNSUBSCRIBE -> {
                String id = accessor.getSubscriptionId();
                if (id != null) {
                    conexion.suscripciones.remove(id);
                }
            }
            case SEND -> {
                if (destination == null || !ENVIO.matcher(destination).matches()) {
                    return cortar(sessionId, Rechazos.BAD_DESTINATION, "destino no permitido");
                }
            }
            default -> {
                // nada
            }
        }
        return message;
    }

    private Conexion nueva() {
        return new Conexion(properties.getRatelimit().getBurst(), System.currentTimeMillis());
    }

    /** Token bucket. Devuelve false si el frame se descarta. */
    private boolean consumir(Conexion conexion, String sessionId) {
        SecurityProperties.RateLimit limit = properties.getRatelimit();
        if (!limit.isEnabled()) {
            return true;
        }
        long now = System.currentTimeMillis();
        boolean cortar;
        synchronized (conexion) {
            double elapsed = (now - conexion.ultimaRecarga) / 1000.0;
            conexion.tokens = Math.min(limit.getBurst(), conexion.tokens + elapsed * limit.getMessagesPerSecond());
            conexion.ultimaRecarga = now;
            if (conexion.tokens >= 1) {
                conexion.tokens -= 1;
                return true;
            }
            if (now - conexion.ventanaDesde > limit.getViolationWindowMs()) {
                conexion.ventanaDesde = now;
                conexion.faltas = 0;
            }
            conexion.faltas++;
            cortar = conexion.faltas > limit.getMaxViolations();
        }
        rechazos.contar(Rechazos.RATE_LIMIT);
        if (cortar) {
            sesiones.cerrar(sessionId, "demasiados mensajes");
        }
        return false;
    }

    private Message<?> cortar(String sessionId, String reason, String motivo) {
        rechazos.contar(reason);
        conexiones.remove(sessionId);
        sesiones.cerrar(sessionId, motivo);
        return null;
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        conexiones.remove(event.getSessionId());
    }
}
