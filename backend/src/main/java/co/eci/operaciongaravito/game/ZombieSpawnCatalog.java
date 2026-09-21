package co.eci.operaciongaravito.game;

import java.util.List;

public final class ZombieSpawnCatalog {

    private static final int HUB_ROW_Y = 736;
    private static final int HUB_ROW_2_Y = 800;

    private static final int AULA_Y = 288;

    public static final List<SpawnPoint> POINTS = List.of(
            new SpawnPoint(160, HUB_ROW_Y),
            new SpawnPoint(480, HUB_ROW_Y),
            new SpawnPoint(800, HUB_ROW_Y),
            new SpawnPoint(1120, HUB_ROW_Y),
            new SpawnPoint(1440, HUB_ROW_Y),
            new SpawnPoint(1760, HUB_ROW_Y),
            new SpawnPoint(2080, HUB_ROW_Y),
            new SpawnPoint(2400, HUB_ROW_Y),
            new SpawnPoint(224, HUB_ROW_2_Y),
            new SpawnPoint(1280, HUB_ROW_2_Y),
            new SpawnPoint(1920, HUB_ROW_2_Y),
            new SpawnPoint(2336, HUB_ROW_2_Y),
            new SpawnPoint(544, AULA_Y),
            new SpawnPoint(736, AULA_Y)
    );

    private ZombieSpawnCatalog() {
    }

    public record SpawnPoint(double x, double y) {
    }
}
