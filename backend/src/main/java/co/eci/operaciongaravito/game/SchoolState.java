package co.eci.operaciongaravito.game;

import java.util.Map;

class SchoolState {

    private int budget = 100;
    private int population = 100;
    private int infrastructureHealth = 100;
    private int security = 100;
    private int happiness = 100;

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

    void reset() {
        budget = 100;
        population = 100;
        infrastructureHealth = 100;
        security = 100;
        happiness = 100;
    }

    private static int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }
}
