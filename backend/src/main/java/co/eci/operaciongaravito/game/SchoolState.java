package co.eci.operaciongaravito.game;

import java.util.Map;

/**
 * Estado compartido del edificio/escuela que las decisiones de ronda
 * modifican (budget, population, infrastructureHealth, security,
 * happiness — los mismos campos documentados en la Wiki de arquitectura).
 *
 * Mutado UNICAMENTE dentro del bloque synchronized de
 * {@link RoundCoordinator#tryResolve}: no necesita su propia sincronizacion
 * porque nunca hay dos hilos tocandola al mismo tiempo (esa es exactamente
 * la garantia que da el punto de resolucion unico).
 */
class SchoolState {

    private int budget = 100;
    private int population = 100;
    private int infrastructureHealth = 100;
    private int security = 100;
    private int happiness = 100;

    /**
     * Placeholder de balance de juego — el diseño real de efectos por
     * accion queda fuera de alcance de este cambio. Una decision real
     * cuesta presupuesto pero sube seguridad/felicidad; una decision por
     * defecto (rol que no llego a tiempo) no cuesta presupuesto pero deja
     * que la infraestructura se deteriore un poco. Alcanza para demostrar
     * que el efecto de la ronda se aplica al estado compartido.
     */
    void applyDecisions(Map<String, String> decisionsByRole, String defaultAction) {
        for (String action : decisionsByRole.values()) {
            if (defaultAction.equals(action)) {
                infrastructureHealth = clamp(infrastructureHealth - 2);
            } else {
                budget = clamp(budget - 5);
                security = clamp(security + 2);
                happiness = clamp(happiness + 2);
            }
        }
    }

    SchoolStateView toSnapshot() {
        return new SchoolStateView(budget, population, infrastructureHealth, security, happiness);
    }

    private static int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }
}
