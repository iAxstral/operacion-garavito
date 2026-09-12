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
}
