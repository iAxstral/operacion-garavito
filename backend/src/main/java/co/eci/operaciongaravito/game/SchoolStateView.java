package co.eci.operaciongaravito.game;

public record SchoolStateView(int budget, int population, int infrastructureHealth, int security, int happiness) {

    public static SchoolStateView initial() {
        return new SchoolStateView(100, 100, 100, 100, 100);
    }
}
