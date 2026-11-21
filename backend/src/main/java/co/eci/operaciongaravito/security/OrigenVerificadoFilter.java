package co.eci.operaciongaravito.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Con {@code security.origin-secret} definido, solo atiende peticiones que traen el
 * header {@code X-Origin-Verify} con ese valor (lo agrega CloudFront al reenviar). El
 * Security Group del EC2 deja entrar a la prefix list de CloudFront, que es la de TODAS
 * las distribuciones de CloudFront, de cualquier cuenta: sin este filtro, alguien podria
 * apuntar su propia distribucion al EC2:8080. Cubre HTTP y el handshake de /ws.
 *
 * <p>Sin la propiedad (local, dev, CI) no hace nada.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class OrigenVerificadoFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Origin-Verify";
    /** Chequeo local de la maquina (no pasa por CloudFront). */
    static final String HEALTH = "/actuator/health";

    private final SecurityProperties properties;
    private final Rechazos rechazos;

    public OrigenVerificadoFilter(SecurityProperties properties, Rechazos rechazos) {
        this.properties = properties;
        this.rechazos = rechazos;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return properties.getOriginSecret().isEmpty() || HEALTH.equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String got = request.getHeader(HEADER);
        byte[] expected = properties.getOriginSecret().getBytes(StandardCharsets.UTF_8);
        if (got == null || !MessageDigest.isEqual(expected, got.getBytes(StandardCharsets.UTF_8))) {
            rechazos.contar(Rechazos.BAD_ORIGIN);
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        chain.doFilter(request, response);
    }
}
