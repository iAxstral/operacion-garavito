package co.eci.operaciongaravito.game;

import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Respuesta minima para que el cliente mida su latencia (ida y vuelta) con este nodo.
 * No toca la base de datos ni las salas: solo devuelve la hora del servidor, y nunca se
 * guarda en cache (una respuesta cacheada daria un ping falso de 0 ms).
 */
@RestController
public class PingController {

    /** Lo que responde {@code GET /api/ping}. */
    public record Pong(long serverTime) {
    }

    private final LongSupplier clock;

    @Autowired
    public PingController() {
        this(System::currentTimeMillis);
    }

    PingController(LongSupplier clock) {
        this.clock = clock;
    }

    @GetMapping("/api/ping")
    public ResponseEntity<Pong> ping() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new Pong(clock.getAsLong()));
    }
}
