
export const REWARD_GARAVITOS = 25;

const zone = (missionId, role, floor, x, y, room) => ({
  missionId, role, floor, x, y, room, rewardGaravitos: REWARD_GARAVITOS,
});

// Espejo de backend/.../MissionCatalog.java, por edificio: las coordenadas de un
// edificio caen dentro de paredes del otro, asi que no se pueden compartir.
const ZONES_BY_BUILDING = {
  // Edificio F: una mision por rol, como estaba antes del Edificio C.
  F: [
    zone('mission-economia', 'ECONOMIA', 1, 1632, 1312, 'Cafetería'),
    zone('mission-seguridad', 'SEGURIDAD', 2, 1632, 1312, 'Armero'),
    zone('mission-salud', 'SALUD', 3, 736, 224, 'Laboratorio'),
    zone('mission-infraestructura', 'INFRAESTRUCTURA', 3, 1632, 1312, 'Sala de Máquinas'),
  ],
  // Edificio C: 2 pisos, una sala por rol en cada piso.
  C: [
    zone('mission-economia', 'ECONOMIA', 1, 1632, 1312, 'Cafetería'),
    zone('mission-economia-f2', 'ECONOMIA', 2, 1568, 160, 'Sala de Reuniones'),
    zone('mission-seguridad-f1', 'SEGURIDAD', 1, 288, 1376, 'Terraza'),
    zone('mission-seguridad', 'SEGURIDAD', 2, 1632, 1312, 'Armero'),
    zone('mission-salud-f1', 'SALUD', 1, 352, 288, 'Sala de Estudio'),
    zone('mission-salud-f2', 'SALUD', 2, 608, 416, 'Biblioteca'),
    zone('mission-infraestructura-f1', 'INFRAESTRUCTURA', 1, 1888, 160, 'Depósito de Servicio'),
    zone('mission-infraestructura-f2', 'INFRAESTRUCTURA', 2, 800, 1376, 'Sala de Estudio'),
  ],
};

export function missionZonesFor(building) {
  return ZONES_BY_BUILDING[building] ?? ZONES_BY_BUILDING.F;
}

export const MISSION_RANGE_PX = 80;
