package co.eci.operaciongaravito.config;

import co.eci.operaciongaravito.security.IpHandshakeInterceptor;
import co.eci.operaciongaravito.security.SecurityProperties;
import co.eci.operaciongaravito.security.SesionesWebSocket;
import co.eci.operaciongaravito.security.StompGuardInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

/**
 * STOMP sobre WebSocket (con SockJS de respaldo). Cada sala publica en
 * {@code /topic/game/{codigo}}; las respuestas privadas (rechazos, codigo de sala nueva)
 * van a la cola de cada conexion, {@code /user/queue/eventos}. Lo que entra lo filtra
 * {@link StompGuardInterceptor}; los limites de transporte salen de {@code security.ws.*}.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final String[] allowedOrigins;
    private final StompGuardInterceptor guard;
    private final IpHandshakeInterceptor ipInterceptor;
    private final SesionesWebSocket sesiones;
    private final SecurityProperties properties;

    public WebSocketConfig(@Value("${app.websocket.allowed-origins}") String[] allowedOrigins,
            StompGuardInterceptor guard, IpHandshakeInterceptor ipInterceptor, SesionesWebSocket sesiones,
            SecurityProperties properties) {
        this.allowedOrigins = allowedOrigins;
        this.guard = guard;
        this.ipInterceptor = ipInterceptor;
        this.sesiones = sesiones;
        this.properties = properties;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .addInterceptors(ipInterceptor)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(guard);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        SecurityProperties.Ws ws = properties.getWs();
        registration.setMessageSizeLimit(ws.getMessageSizeLimit())
                .setSendBufferSizeLimit(ws.getSendBufferSizeLimit())
                .setSendTimeLimit(ws.getSendTimeLimitMs())
                .setTimeToFirstMessage(ws.getTimeToFirstMessageMs())
                .addDecoratorFactory(sesiones::decorate);
    }
}
