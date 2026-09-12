package co.eci.operaciongaravito.game;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Geometria caminable del piso, para que los zombis no atraviesen las paredes.
 *
 * El mapa se define en el frontend (mapLayout.js); este recurso lo genera
 * {@code frontend/scripts/export-floor-grid.mjs} a partir de ahi. Es la unica
 * pieza duplicada entre front y back que NO se mantiene a mano, justamente
 * porque una grilla de 40x30 copiada a mano se desincroniza al primer cambio.
 * Si cambia mapLayout.js hay que volver a correr ese script.
 */
public final class FloorGrid {

    public static final int TILE = 64;

    private static final String RESOURCE = "/floor1.grid";
    private static final FloorGrid FLOOR_1 = load();

    private final char[][] cells;
    private final int cols;
    private final int rows;

    private FloorGrid(char[][] cells) {
        this.cells = cells;
        this.rows = cells.length;
        this.cols = rows == 0 ? 0 : cells[0].length;
    }

    public static FloorGrid floor1() {
        return FLOOR_1;
    }

    private static FloorGrid load() {
        try (InputStream in = FloorGrid.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("falta el recurso " + RESOURCE
                        + " — correr frontend/scripts/export-floor-grid.mjs");
            }
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            List<char[]> rows = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank() || line.startsWith("#GENERADO") || line.startsWith("# ")) {
                    continue; // cabecera del generador
                }
                rows.add(line.toCharArray());
            }
            return new FloorGrid(rows.toArray(char[][]::new));
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    public int pixelWidth() {
        return cols * TILE;
    }

    public int pixelHeight() {
        return rows * TILE;
    }

    /** True si ese punto en pixeles cae en una celda por la que se puede pasar. */
    public boolean isWalkable(double x, double y) {
        int col = (int) Math.floor(x / TILE);
        int row = (int) Math.floor(y / TILE);
        if (col < 0 || row < 0 || row >= rows || col >= cells[row].length) {
            return false;
        }
        return cells[row][col] != '#';
    }

    /**
     * True si un cuerpo circular de ese radio cabe centrado en el punto. Se
     * prueban los cuatro extremos y no solo el centro: con solo el centro, un
     * zombi se incrusta medio cuerpo dentro de la pared antes de frenar.
     */
    public boolean fits(double x, double y, double radius) {
        return isWalkable(x - radius, y - radius)
                && isWalkable(x + radius, y - radius)
                && isWalkable(x - radius, y + radius)
                && isWalkable(x + radius, y + radius);
    }

    /**
     * Mapa de distancias (en celdas) desde un punto hasta cada celda caminable,
     * por BFS. -1 = inalcanzable.
     *
     * Hace falta porque perseguir en linea recta no funciona en un edificio:
     * un zombi que sale del aula y ve al jugador en el vestibulo se clava
     * contra la pared intermedia y no llega nunca. Con este campo, cada zombi
     * solo mira a que celda vecina le conviene pasar, sin calcular una ruta
     * propia. La grilla es de 40x30, asi que recalcularlo por tick es barato.
     */
    public int[][] distanceField(double fromX, double fromY) {
        int[][] distance = new int[rows][];
        for (int row = 0; row < rows; row++) {
            distance[row] = new int[cells[row].length];
            java.util.Arrays.fill(distance[row], -1);
        }

        int startCol = (int) Math.floor(fromX / TILE);
        int startRow = (int) Math.floor(fromY / TILE);
        if (startRow < 0 || startRow >= rows || startCol < 0 || startCol >= cells[startRow].length
                || cells[startRow][startCol] == '#') {
            return distance;
        }

        java.util.ArrayDeque<int[]> queue = new java.util.ArrayDeque<>();
        distance[startRow][startCol] = 0;
        queue.add(new int[] { startCol, startRow });

        int[] dc = { 1, -1, 0, 0 };
        int[] dr = { 0, 0, 1, -1 };
        while (!queue.isEmpty()) {
            int[] current = queue.poll();
            for (int i = 0; i < 4; i++) {
                int col = current[0] + dc[i];
                int row = current[1] + dr[i];
                if (row < 0 || row >= rows || col < 0 || col >= cells[row].length) {
                    continue;
                }
                if (cells[row][col] == '#' || distance[row][col] != -1) {
                    continue;
                }
                distance[row][col] = distance[current[1]][current[0]] + 1;
                queue.add(new int[] { col, row });
            }
        }
        return distance;
    }

    /**
     * Hacia donde moverse desde ese punto para acercarse al origen del campo.
     * Devuelve un vector unitario, o {0,0} si ya se llego o no hay ruta.
     *
     * Se apunta al CENTRO de la celda vecina, no en diagonal libre: eso es lo
     * que mantiene al zombi en el medio del pasillo en vez de rozar las
     * esquinas y quedarse trabado en ellas.
     */
    public double[] flowDirection(int[][] distance, double x, double y) {
        int col = (int) Math.floor(x / TILE);
        int row = (int) Math.floor(y / TILE);
        if (row < 0 || row >= rows || col < 0 || col >= distance[row].length || distance[row][col] <= 0) {
            return new double[] { 0, 0 };
        }

        int best = distance[row][col];
        int bestCol = col;
        int bestRow = row;
        int[] dc = { 1, -1, 0, 0 };
        int[] dr = { 0, 0, 1, -1 };
        for (int i = 0; i < 4; i++) {
            int c = col + dc[i];
            int r = row + dr[i];
            if (r < 0 || r >= rows || c < 0 || c >= distance[r].length) {
                continue;
            }
            int d = distance[r][c];
            if (d != -1 && d < best) {
                best = d;
                bestCol = c;
                bestRow = r;
            }
        }
        if (bestCol == col && bestRow == row) {
            return new double[] { 0, 0 };
        }

        double targetX = bestCol * TILE + TILE / 2.0;
        double targetY = bestRow * TILE + TILE / 2.0;
        double dx = targetX - x;
        double dy = targetY - y;
        double length = Math.hypot(dx, dy);
        return length == 0 ? new double[] { 0, 0 } : new double[] { dx / length, dy / length };
    }
}
