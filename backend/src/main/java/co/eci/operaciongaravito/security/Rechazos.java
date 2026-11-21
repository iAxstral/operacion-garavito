package co.eci.operaciongaravito.security;

import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Cuenta lo que se rechaza por seguridad en {@code garavito.rejected{reason=...}}:
 * es lo que muestra el panel de ataques de Grafana. Las razones se registran al
 * arrancar para que aparezcan en Prometheus aunque esten en cero.
 */
@Component
public class Rechazos {

    public static final String RATE_LIMIT = "rate_limit";
    public static final String BAD_SUBSCRIBE = "bad_subscribe";
    public static final String BAD_DESTINATION = "bad_destination";
    public static final String BAD_PAYLOAD = "bad_payload";
    public static final String BAD_TOKEN = "bad_token";
    public static final String ROOM_CAP = "room_cap";
    public static final String SEAT_CAP = "seat_cap";
    public static final String IDLE = "idle";
    public static final String BAD_ORIGIN = "bad_origin";
    public static final String API_RATE_LIMIT = "api_rate_limit";
    public static final String CONN_CAP = "conn_cap";

    static final List<String> REASONS = List.of(RATE_LIMIT, BAD_SUBSCRIBE, BAD_DESTINATION, BAD_PAYLOAD, BAD_TOKEN,
            ROOM_CAP, SEAT_CAP, IDLE, BAD_ORIGIN, API_RATE_LIMIT, CONN_CAP);

    private final MeterRegistry registry;

    public Rechazos(MeterRegistry registry) {
        this.registry = registry;
        REASONS.forEach(reason -> registry.counter("garavito.rejected", "reason", reason));
    }

    public void contar(String reason) {
        registry.counter("garavito.rejected", "reason", reason).increment();
    }
}
