package co.eci.operaciongaravito.game;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Estado en vivo de este nodo para la pagina publica del frontend. */
@RestController
public class EstadoController {

    private final GameSessionService sessionService;

    public EstadoController(GameSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/api/estado")
    public EstadoServidor estado() {
        return sessionService.estado();
    }
}
