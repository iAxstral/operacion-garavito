package co.eci.operaciongaravito.game;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class FloorGrid {

    public static final int TILE = 64;

    public static final int FLOOR_COUNT = 3;

    public record DoorSpec(String doorId, int col, int row) {
        public double centerX() {
            return col * TILE + TILE / 2.0;
        }

        public double centerY() {
            return row * TILE + TILE / 2.0;
        }
    }

    private record Template(char[][] cells, List<DoorSpec> doors) {
    }

    private static final Template[] TEMPLATES = loadTemplates();

    private final char[][] cells;
    private final int cols;
    private final int rows;

    private final Map<String, int[]> doorCells = new ConcurrentHashMap<>();
    private final Set<String> closedDoors = ConcurrentHashMap.newKeySet();

    private final List<DoorSpec> doors;

    private FloorGrid(char[][] cells, List<DoorSpec> doors) {
        this.cells = cells;
        this.doors = doors;
        this.rows = cells.length;
        this.cols = rows == 0 ? 0 : cells[0].length;
    }

    public static FloorGrid forFloor(int floor) {
        if (floor < 1 || floor > FLOOR_COUNT) {
            throw new IllegalArgumentException("piso inexistente: " + floor);
        }
        Template template = TEMPLATES[floor - 1];
        char[][] copy = new char[template.cells().length][];
        for (int i = 0; i < copy.length; i++) {
            copy[i] = template.cells()[i].clone();
        }
        FloorGrid grid = new FloorGrid(copy, template.doors());
        template.doors().forEach(spec -> grid.registerDoor(spec.doorId(), spec.col(), spec.row()));
        return grid;
    }

    public List<DoorSpec> doors() {
        return doors;
    }

    public void registerDoor(String doorId, int col, int row) {
        doorCells.put(doorId, new int[] { col, row });
    }

    public boolean isDoorOpen(String doorId) {
        return !closedDoors.contains(doorId);
    }

    public void setDoorOpen(String doorId, boolean open) {
        if (!doorCells.containsKey(doorId)) {
            return;
        }
        if (open) {
            closedDoors.remove(doorId);
        } else {
            closedDoors.add(doorId);
        }
    }

    public void resetDoors() {
        closedDoors.clear();
    }

    private boolean isClosedDoorCell(int col, int row) {
        if (closedDoors.isEmpty()) {
            return false;
        }
        for (String doorId : closedDoors) {
            int[] pos = doorCells.get(doorId);
            if (pos != null && pos[0] == col && pos[1] == row) {
                return true;
            }
        }
        return false;
    }

    private static Template[] loadTemplates() {
        Template[] templates = new Template[FLOOR_COUNT];
        for (int floor = 1; floor <= FLOOR_COUNT; floor++) {
            templates[floor - 1] = loadTemplate("/floor" + floor + ".grid");
        }
        return templates;
    }

    private static Template loadTemplate(String resource) {
        try (InputStream in = FloorGrid.class.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("falta el recurso " + resource
                        + " — correr frontend/scripts/export-floor-grid.mjs");
            }
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            List<char[]> rows = new ArrayList<>();
            List<DoorSpec> doors = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank() || line.startsWith("#GENERADO") || line.startsWith("# ")) {
                    continue;
                }
                if (line.startsWith("door ")) {
                    String[] parts = line.split(" ");
                    doors.add(new DoorSpec(parts[1], Integer.parseInt(parts[2]), Integer.parseInt(parts[3])));
                    continue;
                }
                rows.add(line.toCharArray());
            }
            return new Template(rows.toArray(char[][]::new), List.copyOf(doors));
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

    public boolean isWalkable(double x, double y) {
        int col = (int) Math.floor(x / TILE);
        int row = (int) Math.floor(y / TILE);
        if (col < 0 || row < 0 || row >= rows || col >= cells[row].length) {
            return false;
        }
        return cells[row][col] != '#' && !isClosedDoorCell(col, row);
    }

    public boolean fits(double x, double y, double radius) {
        return isWalkable(x - radius, y - radius)
                && isWalkable(x + radius, y - radius)
                && isWalkable(x - radius, y + radius)
                && isWalkable(x + radius, y + radius);
    }

    public int[][] distanceField(double fromX, double fromY) {
        int[][] distance = new int[rows][];
        for (int row = 0; row < rows; row++) {
            distance[row] = new int[cells[row].length];
            java.util.Arrays.fill(distance[row], -1);
        }

        int startCol = (int) Math.floor(fromX / TILE);
        int startRow = (int) Math.floor(fromY / TILE);
        if (startRow < 0 || startRow >= rows || startCol < 0 || startCol >= cells[startRow].length
                || cells[startRow][startCol] == '#' || isClosedDoorCell(startCol, startRow)) {
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
                if (cells[row][col] == '#' || distance[row][col] != -1 || isClosedDoorCell(col, row)) {
                    continue;
                }
                distance[row][col] = distance[current[1]][current[0]] + 1;
                queue.add(new int[] { col, row });
            }
        }
        return distance;
    }

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
