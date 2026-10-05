package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AStarPathfinderTest {

    /** '#' bloqueado, '.' libre. Devuelve walkable[fila][columna]. */
    private static boolean[][] grid(String... rows) {
        boolean[][] walkable = new boolean[rows.length][];
        for (int r = 0; r < rows.length; r++) {
            walkable[r] = new boolean[rows[r].length()];
            for (int c = 0; c < rows[r].length(); c++) {
                walkable[r][c] = rows[r].charAt(c) != '#';
            }
        }
        return walkable;
    }

    /** Cada paso es a una celda vecina (4 direcciones) y ninguna celda esta bloqueada. */
    private static void assertValidPath(boolean[][] walkable, List<int[]> path, int[] start, int[] goal) {
        assertArrayEquals(start, path.get(0), "el camino empieza en el inicio");
        assertArrayEquals(goal, path.get(path.size() - 1), "el camino termina en la meta");
        for (int i = 0; i < path.size(); i++) {
            int[] cell = path.get(i);
            assertTrue(walkable[cell[1]][cell[0]], "el camino pisa una celda bloqueada: " + cell[0] + "," + cell[1]);
            if (i > 0) {
                int[] prev = path.get(i - 1);
                assertEquals(1, Math.abs(cell[0] - prev[0]) + Math.abs(cell[1] - prev[1]), "salto no 4-direccional");
            }
        }
    }

    @Test
    @DisplayName("sin obstaculos va en linea recta")
    void straightLine() {
        boolean[][] walkable = grid(".....");
        List<int[]> path = AStarPathfinder.findPath(walkable, new int[] { 0, 0 }, new int[] { 4, 0 });
        assertEquals(5, path.size());
        assertValidPath(walkable, path, new int[] { 0, 0 }, new int[] { 4, 0 });
    }

    @Test
    @DisplayName("rodea un obstaculo por el unico hueco y con el camino mas corto")
    void goesAroundAnObstacle() {
        boolean[][] walkable = grid(
                ".....",
                "..#..",
                "..#..",
                "..#..",
                ".....");
        int[] start = { 0, 2 };
        int[] goal = { 4, 2 };
        List<int[]> path = AStarPathfinder.findPath(walkable, start, goal);

        assertValidPath(walkable, path, start, goal);
        // Por arriba o por abajo del muro: 2 para llegar a la fila libre, 4 de ancho, 2 de vuelta.
        assertEquals(9, path.size(), "deberia ser el camino de largo minimo");
        assertTrue(path.stream().anyMatch(cell -> cell[1] == 0 || cell[1] == 4),
                "deberia pasar por encima o por debajo del muro");
    }

    @Test
    @DisplayName("encuentra el unico hueco de una pared larga")
    void findsTheOnlyGap() {
        boolean[][] walkable = grid(
                "......",
                "#####.",
                "......");
        int[] start = { 0, 0 };
        int[] goal = { 0, 2 };
        List<int[]> path = AStarPathfinder.findPath(walkable, start, goal);

        assertValidPath(walkable, path, start, goal);
        assertTrue(path.stream().anyMatch(cell -> cell[0] == 5 && cell[1] == 1), "tiene que usar el hueco");
        assertEquals(13, path.size());
    }

    @Test
    @DisplayName("sin camino posible devuelve una lista vacia")
    void noPath() {
        boolean[][] walkable = grid(
                "..#..",
                "..#..",
                "..#..");
        assertTrue(AStarPathfinder.findPath(walkable, new int[] { 0, 0 }, new int[] { 4, 0 }).isEmpty());
    }

    @Test
    @DisplayName("una meta o un inicio bloqueado o fuera de la grilla no tiene camino")
    void blockedOrOutsideEndpoints() {
        boolean[][] walkable = grid("..#");
        assertTrue(AStarPathfinder.findPath(walkable, new int[] { 0, 0 }, new int[] { 2, 0 }).isEmpty());
        assertTrue(AStarPathfinder.findPath(walkable, new int[] { 2, 0 }, new int[] { 0, 0 }).isEmpty());
        assertTrue(AStarPathfinder.findPath(walkable, new int[] { 0, 0 }, new int[] { 9, 9 }).isEmpty());
    }

    @Test
    @DisplayName("si ya esta en la meta el camino es solo esa celda")
    void startIsGoal() {
        List<int[]> path = AStarPathfinder.findPath(grid("..."), new int[] { 1, 0 }, new int[] { 1, 0 });
        assertEquals(1, path.size());
        assertArrayEquals(new int[] { 1, 0 }, path.get(0));
    }

    @Test
    @DisplayName("en el mapa real del Edificio F sale del aula por la puerta hasta el vestibulo")
    void realMapThroughTheDoor() {
        boolean[][] walkable = FloorGrid.forFloor(Building.F, 1).walkableSnapshot();
        int[] aula = FloorGrid.cellOf(736, 288);
        int[] vestibulo = FloorGrid.cellOf(1056, 736);
        List<int[]> path = AStarPathfinder.findPath(walkable, aula, vestibulo);

        assertValidPath(walkable, path, aula, vestibulo);
        assertTrue(path.stream().anyMatch(cell -> cell[0] == 9 && cell[1] == 8), "tiene que salir por la puerta (col 9)");
    }

    @Test
    @DisplayName("una puerta cerrada corta el camino")
    void closedDoorsBlockThePath() {
        FloorGrid floor = FloorGrid.forFloor(Building.F, 1);
        FloorGrid.DoorSpec door = floor.doors().stream()
                .filter(d -> d.col() == 9 && d.row() < 10).findFirst().orElseThrow();
        floor.setDoorOpen(door.doorId(), false);

        List<int[]> path = AStarPathfinder.findPath(floor.walkableSnapshot(),
                FloorGrid.cellOf(736, 288), FloorGrid.cellOf(1056, 736));
        assertTrue(path.isEmpty(), "con la unica puerta del aula cerrada no hay salida");
    }
}
