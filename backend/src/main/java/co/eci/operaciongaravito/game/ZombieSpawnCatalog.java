package co.eci.operaciongaravito.game;

import java.util.List;

/**
 * Puntos donde puede aparecer un zombi en el piso 1.
 *
 * El servidor no tiene el mapa (la geometria vive en mapLayout.js), asi que
 * en vez de spawnear en un anillo alrededor del jugador —que caeria dentro de
 * los muros— se usa una lista fija de posiciones verificadas como caminables.
 * Es el mismo criterio de duplicacion deliberada que ya usan
 * {@link MissionCatalog} y {@link ShopCatalog} contra sus pares en JS.
 *
 * Cada punto se eligio exigiendo que sus 8 celdas vecinas tambien sean
 * caminables, para que un zombi nunca aparezca encajado contra una pared:
 * sin pathfinding, un zombi atorado no se recupera solo. Si el mapa cambia,
 * esta lista hay que regenerarla.
 */
public final class ZombieSpawnCatalog {

    /** Vestibulo central: el corredor que cruza el piso de lado a lado. */
    private static final int HUB_ROW_Y = 736;
    private static final int HUB_ROW_2_Y = 800;
    /** Aula F-104, arriba a la izquierda. */
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
