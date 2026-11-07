package co.eci.operaciongaravito.security;

import org.springframework.stereotype.Component;

/**
 * IP del cliente para los limites por IP. Detras de CloudFront la conexion viene de un
 * servidor de CloudFront, asi que la IP real es el ultimo valor de X-Forwarded-For (el
 * que agrega CloudFront; lo anterior lo puede escribir el cliente). Solo se confia en
 * ese header con {@code security.trust-forwarded-for=true}, que en produccion va junto
 * al filtro de origen: sin el header secreto la peticion ni siquiera llega aqui.
 */
@Component
public class ClientIp {

    private final SecurityProperties properties;

    public ClientIp(SecurityProperties properties) {
        this.properties = properties;
    }

    public String resolve(String remoteAddress, String forwardedFor) {
        if (properties.isTrustForwardedFor() && forwardedFor != null && !forwardedFor.isBlank()) {
            String[] parts = forwardedFor.split(",");
            String last = parts[parts.length - 1].strip();
            if (!last.isEmpty() && last.length() <= 64) {
                return last;
            }
        }
        return remoteAddress == null ? "desconocida" : remoteAddress;
    }
}
