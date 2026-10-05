package co.eci.operaciongaravito.game;

/**
 * Minijuegos de mision, dos por rol (espejo de frontend/src/game/missionCatalog.js).
 * Cada Kinder a cada jugador le tocan tres, mezclando los dos tipos de su rol.
 */
public enum MissionType {
    CAMARAS(Role.SEGURIDAD),
    CODIGO(Role.SEGURIDAD),
    CABLES(Role.SALUD),
    VACUNA(Role.SALUD),
    CUENTAS(Role.ECONOMIA),
    CAJA(Role.ECONOMIA),
    TORRE(Role.INFRAESTRUCTURA),
    FUSIBLES(Role.INFRAESTRUCTURA);

    private final Role role;

    MissionType(Role role) {
        this.role = role;
    }

    public Role role() {
        return role;
    }

    public static java.util.List<MissionType> forRole(Role role) {
        return java.util.Arrays.stream(values()).filter(type -> type.role == role).toList();
    }
}
