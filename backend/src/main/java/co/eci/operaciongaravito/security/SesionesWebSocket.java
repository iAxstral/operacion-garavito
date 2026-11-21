package co.eci.operaciongaravito.security;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

/**
 * Las conexiones WebSocket abiertas, por id (el mismo id que STOMP llama simpSessionId):
 * permite cortar a quien abusa y cerrar las que no mandan nada.
 *
 * <p>Spring tiene {@code setTimeToFirstMessage}, pero solo revisa cuando hay trafico de
 * salida; aqui se revisa cada segundo, aunque el servidor este quieto.
 *
 * <p>Tambien limita cuantas conexiones abiertas a la vez puede tener una IP: sin eso, una
 * sola maquina abre cientos y prueba codigos de sala en paralelo.
 */
@Component
public class SesionesWebSocket {

    private static final System.Logger LOGGER = System.getLogger(SesionesWebSocket.class.getName());

    private record Abierta(WebSocketSession session, long openedAt) {
    }

    private final Map<String, Abierta> abiertas = new ConcurrentHashMap<>();
    /** Conexiones que ya mandaron su CONNECT de STOMP. */
    private final Map<String, Boolean> conectadas = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> porIp = new ConcurrentHashMap<>();
    /** IP de cada conexion que se conto (para descontarla al cerrar). */
    private final Map<String, String> ipDe = new ConcurrentHashMap<>();
    private final SecurityProperties properties;
    private final Rechazos rechazos;
    private final ScheduledExecutorService checker = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "ws-idle-check");
        thread.setDaemon(true);
        return thread;
    });

    public SesionesWebSocket(SecurityProperties properties, Rechazos rechazos) {
        this.properties = properties;
        this.rechazos = rechazos;
        checker.scheduleAtFixedRate(this::cerrarMudas, 1, 1, TimeUnit.SECONDS);
    }

    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                Object ip = session.getAttributes().get(IpHandshakeInterceptor.IP_ATTRIBUTE);
                if (ip != null) {
                    int abiertasDeIp = porIp.computeIfAbsent(ip.toString(), k -> new AtomicInteger()).incrementAndGet();
                    ipDe.put(session.getId(), ip.toString());
                    if (abiertasDeIp > properties.getWs().getMaxConnectionsPerIp()) {
                        rechazos.contar(Rechazos.CONN_CAP);
                        session.close(CloseStatus.POLICY_VIOLATION.withReason("demasiadas conexiones"));
                        return;
                    }
                }
                abiertas.put(session.getId(), new Abierta(session, System.currentTimeMillis()));
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
                abiertas.remove(session.getId());
                conectadas.remove(session.getId());
                String ip = ipDe.remove(session.getId());
                if (ip != null) {
                    porIp.computeIfPresent(ip, (k, count) -> count.decrementAndGet() <= 0 ? null : count);
                }
                super.afterConnectionClosed(session, closeStatus);
            }
        };
    }

    void marcarConectada(String sessionId) {
        if (sessionId != null) {
            conectadas.put(sessionId, Boolean.TRUE);
        }
    }

    /** Corta la conexion (codigo 1008, policy violation). */
    public void cerrar(String sessionId, String motivo) {
        Abierta abierta = sessionId == null ? null : abiertas.get(sessionId);
        if (abierta == null) {
            return;
        }
        try {
            abierta.session().close(CloseStatus.POLICY_VIOLATION.withReason(motivo));
        } catch (IOException | RuntimeException ex) {
            LOGGER.log(System.Logger.Level.DEBUG, "no se pudo cerrar la conexion " + sessionId);
        }
    }

    private void cerrarMudas() {
        long limite = System.currentTimeMillis() - properties.getWs().getTimeToFirstMessageMs();
        abiertas.forEach((id, abierta) -> {
            if (abierta.openedAt() < limite && !conectadas.containsKey(id)) {
                rechazos.contar(Rechazos.IDLE);
                cerrar(id, "sin mensajes");
            }
        });
    }

    @PreDestroy
    void shutdown() {
        checker.shutdownNow();
    }
}
