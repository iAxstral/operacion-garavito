package co.eci.operaciongaravito.game;

/**
 * Edificio de una sala. Cada uno tiene su propio mapa (grillas en
 * resources/grids/{edificio}), sus misiones y su numero de pisos, espejo de
 * frontend/src/game/mapLayout.js.
 */
public enum Building {
    F(3),
    C(2),
    /** Ingenieria: laboratorios y talleres. */
    G(2),
    /** Administrativo: oficinas, rectoria y centro de datos. */
    A(3),
    /** Ciencias Basicas: laboratorios de fisica, quimica y biologia. */
    B(3),
    /** Biblioteca: estantes, hemeroteca y salas de lectura. */
    BIBLIOTECA(2);

    private final int floorCount;

    Building(int floorCount) {
        this.floorCount = floorCount;
    }

    public int floorCount() {
        return floorCount;
    }

    public boolean hasFloor(int floor) {
        return floor >= 1 && floor <= floorCount;
    }

    /** Edificio por defecto si el cliente no manda uno valido (clientes viejos). */
    public static Building parseOrDefault(String value) {
        if (value == null) {
            return F;
        }
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return F;
        }
    }
}
