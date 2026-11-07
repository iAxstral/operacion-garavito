package co.eci.operaciongaravito.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Limite de peticiones por IP en {@code /api/**} (token bucket, security.api.*). El
 * frontend pide /api/estado cada 3 s y /api/ping cada pocos segundos: muy por debajo.
 * Las cubetas que no se usan hace un minuto se borran, para que llenar el mapa con IPs
 * distintas no sirva para gastar memoria.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ApiRateLimitFilter extends OncePerRequestFilter {

    private static final long IDLE_MS = 60_000;
    private static final int MAX_BUCKETS = 50_000;

    private static final class Cubeta {
        double tokens;
        long last;

        Cubeta(double tokens, long now) {
            this.tokens = tokens;
            this.last = now;
        }
    }

    private final Map<String, Cubeta> cubetas = new ConcurrentHashMap<>();
    private final SecurityProperties properties;
    private final ClientIp clientIp;
    private final Rechazos rechazos;
    private volatile long lastSweep = System.currentTimeMillis();

    public ApiRateLimitFilter(SecurityProperties properties, ClientIp clientIp, Rechazos rechazos) {
        this.properties = properties;
        this.clientIp = clientIp;
        this.rechazos = rechazos;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !properties.getApi().isRatelimitEnabled() || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long now = System.currentTimeMillis();
        sweep(now);
        String ip = clientIp.resolve(request.getRemoteAddr(), request.getHeader("X-Forwarded-For"));
        SecurityProperties.Api api = properties.getApi();
        Cubeta cubeta = cubetas.computeIfAbsent(ip, k -> new Cubeta(api.getBurst(), now));
        boolean allowed;
        synchronized (cubeta) {
            cubeta.tokens = Math.min(api.getBurst(), cubeta.tokens + (now - cubeta.last) / 1000.0 * api.getRequestsPerSecond());
            cubeta.last = now;
            allowed = cubeta.tokens >= 1;
            if (allowed) {
                cubeta.tokens -= 1;
            }
        }
        if (!allowed) {
            rechazos.contar(Rechazos.API_RATE_LIMIT);
            response.setStatus(429);
            response.setHeader("Retry-After", "1");
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"too_many_requests\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private void sweep(long now) {
        if (now - lastSweep < 10_000 && cubetas.size() < MAX_BUCKETS) {
            return;
        }
        lastSweep = now;
        cubetas.values().removeIf(c -> now - c.last > IDLE_MS);
        if (cubetas.size() >= MAX_BUCKETS) {
            cubetas.clear(); // inundacion de IPs falsas: se empieza de cero antes que crecer sin limite
        }
    }
}
