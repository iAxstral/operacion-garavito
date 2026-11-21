package co.eci.operaciongaravito.security;

import java.util.Map;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/** Guarda la IP del cliente en la sesion WebSocket para los limites por IP. */
@Component
public class IpHandshakeInterceptor implements HandshakeInterceptor {

    public static final String IP_ATTRIBUTE = "garavito.ip";

    private final ClientIp clientIp;

    public IpHandshakeInterceptor(ClientIp clientIp) {
        this.clientIp = clientIp;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
            Map<String, Object> attributes) {
        String remote = request.getRemoteAddress() == null ? null
                : request.getRemoteAddress().getAddress().getHostAddress();
        attributes.put(IP_ATTRIBUTE, clientIp.resolve(remote, request.getHeaders().getFirst("X-Forwarded-For")));
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
            Exception exception) {
        // nada
    }
}
