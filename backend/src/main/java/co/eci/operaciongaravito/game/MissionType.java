package co.eci.operaciongaravito.game;

/**
 * Minijuegos de mision, cuatro por rol (espejo de frontend/src/game/missionCatalog.js).
 * Cada Kinder a cada jugador le tocan tres distintos de su rol.
 */
public enum MissionType {
    CAMARAS(Role.SEGURIDAD),
    CODIGO(Role.SEGURIDAD),
    RONDA(Role.SEGURIDAD),
    SENSORES(Role.SEGURIDAD),
    CABLES(Role.SALUD),
    VACUNA(Role.SALUD),
    PULSO(Role.SALUD),
    MEDICAMENTOS(Role.SALUD),
    CUENTAS(Role.ECONOMIA),
    CAJA(Role.ECONOMIA),
    PRESUPUESTO(Role.ECONOMIA),
    FACTURAS(Role.ECONOMIA),
    TORRE(Role.INFRAESTRUCTURA),
    FUSIBLES(Role.INFRAESTRUCTURA),
    TUBERIAS(Role.INFRAESTRUCTURA),
    NIVEL(Role.INFRAESTRUCTURA);

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
