package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.PriorityQueue;

/**
 * A* estandar sobre una grilla {@code walkable[fila][columna]}: 4 direcciones,
 * costo 1 por paso y heuristica Manhattan (admisible con 4 direcciones, asi que el
 * camino que devuelve es de largo minimo).
 */
public final class AStarPathfinder {

    private static final int[] DC = { 1, -1, 0, 0 };
    private static final int[] DR = { 0, 0, 1, -1 };

    private AStarPathfinder() {
    }

    /**
     * @param start {columna, fila}
     * @param goal  {columna, fila}
     * @return las celdas {columna, fila} desde {@code start} hasta {@code goal}, ambas
     *         incluidas; una lista vacia si no hay camino o alguno de los extremos no es
     *         caminable.
     */
    public static List<int[]> findPath(boolean[][] walkable, int[] start, int[] goal) {
        if (!isOpen(walkable, start[0], start[1]) || !isOpen(walkable, goal[0], goal[1])) {
            return List.of();
        }
        int rows = walkable.length;
        int cols = walkable[0].length;

        int[] gScore = new int[rows * cols];
        java.util.Arrays.fill(gScore, Integer.MAX_VALUE);
        int[] cameFrom = new int[rows * cols];
        java.util.Arrays.fill(cameFrom, -1);
        boolean[] closed = new boolean[rows * cols];

        int startIndex = start[1] * cols + start[0];
        int goalIndex = goal[1] * cols + goal[0];
        gScore[startIndex] = 0;

        // {f, h, indice}: a igual f se prefiere el de menor h (el mas cercano a la meta).
        PriorityQueue<int[]> open = new PriorityQueue<>((a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0])
                : Integer.compare(a[1], b[1]));
        int h0 = manhattan(start[0], start[1], goal);
        open.add(new int[] { h0, h0, startIndex });

        while (!open.isEmpty()) {
            int current = open.poll()[2];
            if (current == goalIndex) {
                return reconstruct(cameFrom, current, cols);
            }
            if (closed[current]) {
                continue;
            }
            closed[current] = true;

            int col = current % cols;
            int row = current / cols;
            for (int i = 0; i < 4; i++) {
                int nc = col + DC[i];
                int nr = row + DR[i];
                if (!isOpen(walkable, nc, nr)) {
                    continue;
                }
                int next = nr * cols + nc;
                if (closed[next]) {
                    continue;
                }
                int tentative = gScore[current] + 1;
                if (tentative < gScore[next]) {
                    gScore[next] = tentative;
                    cameFrom[next] = current;
                    int h = manhattan(nc, nr, goal);
                    open.add(new int[] { tentative + h, h, next });
                }
            }
        }
        return List.of();
    }

    private static boolean isOpen(boolean[][] walkable, int col, int row) {
        return row >= 0 && row < walkable.length && col >= 0 && col < walkable[row].length && walkable[row][col];
    }

    private static int manhattan(int col, int row, int[] goal) {
        return Math.abs(col - goal[0]) + Math.abs(row - goal[1]);
    }

    private static List<int[]> reconstruct(int[] cameFrom, int end, int cols) {
        List<int[]> path = new ArrayList<>();
        for (int index = end; index != -1; index = cameFrom[index]) {
            path.add(new int[] { index % cols, index / cols });
        }
        Collections.reverse(path);
        return path;
    }
}
