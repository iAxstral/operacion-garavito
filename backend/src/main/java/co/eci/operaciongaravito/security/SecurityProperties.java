package co.eci.operaciongaravito.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Limites de abuso de las APIs ({@code security.*} en application.properties). Los
 * valores por defecto son los de produccion; el perfil {@code carga} los afloja para
 * k6 y frontend/scripts/load-test.mjs (ver docs/SEGURIDAD.md).
 */
@Component
@ConfigurationProperties(prefix = "security")
public class SecurityProperties {

    /** Valor del header X-Origin-Verify que pone CloudFront; vacio = sin filtro (local). */
    private String originSecret = "";
    /** Usar X-Forwarded-For (ultimo valor, el que agrega CloudFront) como IP del cliente. */
    private boolean trustForwardedFor = false;

    private final RateLimit ratelimit = new RateLimit();
    private final Stomp stomp = new Stomp();
    private final Ws ws = new Ws();
    private final Rooms rooms = new Rooms();
    private final Api api = new Api();

    public static class RateLimit {
        private boolean enabled = true;
        /** Mensajes por segundo sostenidos por conexion (el cliente manda ~10/s moviendose). */
        private double messagesPerSecond = 40;
        /** Rafaga maxima por conexion. */
        private int burst = 80;
        /** Mensajes descartados dentro de {@code violationWindowMs} antes de cortar la conexion. */
        private int maxViolations = 200;
        private long violationWindowMs = 10_000;

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public double getMessagesPerSecond() { return messagesPerSecond; }
        public void setMessagesPerSecond(double v) { this.messagesPerSecond = v; }
        public int getBurst() { return burst; }
        public void setBurst(int burst) { this.burst = burst; }
        public int getMaxViolations() { return maxViolations; }
        public void setMaxViolations(int v) { this.maxViolations = v; }
        public long getViolationWindowMs() { return violationWindowMs; }
        public void setViolationWindowMs(long v) { this.violationWindowMs = v; }
    }

    public static class Stomp {
        /** Suscripciones simultaneas por conexion (el cliente usa 2: su sala y su cola privada). */
        private int maxSubscriptions = 4;

        public int getMaxSubscriptions() { return maxSubscriptions; }
        public void setMaxSubscriptions(int v) { this.maxSubscriptions = v; }
    }

    public static class Ws {
        private int messageSizeLimit = 8 * 1024;
        private int sendBufferSizeLimit = 512 * 1024;
        private int sendTimeLimitMs = 10_000;
        /** Una conexion que no manda el CONNECT de STOMP en este tiempo se cierra. */
        private int timeToFirstMessageMs = 10_000;

        public int getMessageSizeLimit() { return messageSizeLimit; }
        public void setMessageSizeLimit(int v) { this.messageSizeLimit = v; }
        public int getSendBufferSizeLimit() { return sendBufferSizeLimit; }
        public void setSendBufferSizeLimit(int v) { this.sendBufferSizeLimit = v; }
        public int getSendTimeLimitMs() { return sendTimeLimitMs; }
        public void setSendTimeLimitMs(int v) { this.sendTimeLimitMs = v; }
        public int getTimeToFirstMessageMs() { return timeToFirstMessageMs; }
        public void setTimeToFirstMessageMs(int v) { this.timeToFirstMessageMs = v; }
    }

    public static class Rooms {
        /** Salas a la vez en este nodo. */
        private int maxPerNode = 200;
        /** Salas que puede crear una misma conexion. */
        private int maxPerConnection = 3;
        /** Salas que puede crear una misma IP dentro de {@code ipWindowMs}. */
        private int maxPerIp = 20;
        private long ipWindowMs = 10 * 60_000;
        /** Una sala sin jugadores mas de este tiempo se borra. */
        private long emptyTtlMs = 60_000;
        /** Modo heredado: el cliente elige el codigo al crear (solo para k6 / pruebas de carga). */
        private boolean clientCodesAllowed = false;
        /** Largo del codigo que genera el servidor (entre 4 y 8). */
        private int codeLength = 6;

        public int getMaxPerNode() { return maxPerNode; }
        public void setMaxPerNode(int v) { this.maxPerNode = v; }
        public int getMaxPerConnection() { return maxPerConnection; }
        public void setMaxPerConnection(int v) { this.maxPerConnection = v; }
        public int getMaxPerIp() { return maxPerIp; }
        public void setMaxPerIp(int v) { this.maxPerIp = v; }
        public long getIpWindowMs() { return ipWindowMs; }
        public void setIpWindowMs(long v) { this.ipWindowMs = v; }
        public long getEmptyTtlMs() { return emptyTtlMs; }
        public void setEmptyTtlMs(long v) { this.emptyTtlMs = v; }
        public boolean isClientCodesAllowed() { return clientCodesAllowed; }
        public void setClientCodesAllowed(boolean v) { this.clientCodesAllowed = v; }
        public int getCodeLength() { return codeLength; }
        public void setCodeLength(int v) { this.codeLength = Math.max(4, Math.min(8, v)); }
    }

    public static class Api {
        /** Limite de peticiones REST (/api/**) por IP. */
        private boolean ratelimitEnabled = true;
        private double requestsPerSecond = 10;
        private int burst = 30;
        /** Cuanto se guarda en cache el ranking. */
        private long rankingCacheMs = 8_000;

        public boolean isRatelimitEnabled() { return ratelimitEnabled; }
        public void setRatelimitEnabled(boolean v) { this.ratelimitEnabled = v; }
        public double getRequestsPerSecond() { return requestsPerSecond; }
        public void setRequestsPerSecond(double v) { this.requestsPerSecond = v; }
        public int getBurst() { return burst; }
        public void setBurst(int v) { this.burst = v; }
        public long getRankingCacheMs() { return rankingCacheMs; }
        public void setRankingCacheMs(long v) { this.rankingCacheMs = v; }
    }

    public String getOriginSecret() { return originSecret; }
    public void setOriginSecret(String v) { this.originSecret = v == null ? "" : v; }
    public boolean isTrustForwardedFor() { return trustForwardedFor; }
    public void setTrustForwardedFor(boolean v) { this.trustForwardedFor = v; }
    public RateLimit getRatelimit() { return ratelimit; }
    public Stomp getStomp() { return stomp; }
    public Ws getWs() { return ws; }
    public Rooms getRooms() { return rooms; }
    public Api getApi() { return api; }
}
