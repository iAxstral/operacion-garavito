
export const REWARD_GARAVITOS = 25;

// 3 salas por rol (una por piso), para que la misión de cada rol no viva siempre en
// el mismo salón. Los 4 ids originales (uno por rol) NO cambiaron de id ni de
// coordenadas — el resto son instancias nuevas agregadas en otras salas ya existentes.
export const MISSION_ZONES = [
  // ECONOMIA
  { missionId: 'mission-economia', role: 'ECONOMIA', floor: 1, x: 1632, y: 1312, room: 'Cafetería', rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-economia-f2', role: 'ECONOMIA', floor: 2, x: 1568, y: 160, room: 'Sala de Reuniones', rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-economia-f3', role: 'ECONOMIA', floor: 3, x: 480, y: 1120, room: 'Auditorio', rewardGaravitos: REWARD_GARAVITOS },

  // SEGURIDAD
  { missionId: 'mission-seguridad', role: 'SEGURIDAD', floor: 2, x: 1632, y: 1312, room: 'Armero', rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-seguridad-f1', role: 'SEGURIDAD', floor: 1, x: 288, y: 1376, room: 'Terraza', rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-seguridad-f3', role: 'SEGURIDAD', floor: 3, x: 1760, y: 416, room: 'Sala de Servidores', rewardGaravitos: REWARD_GARAVITOS },

  // SALUD
  { missionId: 'mission-salud', role: 'SALUD', floor: 3, x: 736, y: 224, room: 'Laboratorio', rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-salud-f1', role: 'SALUD', floor: 1, x: 352, y: 288, room: 'Sala de Estudio', rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-salud-f2', role: 'SALUD', floor: 2, x: 608, y: 416, room: 'Biblioteca', rewardGaravitos: REWARD_GARAVITOS },

  // INFRAESTRUCTURA
  { missionId: 'mission-infraestructura', role: 'INFRAESTRUCTURA', floor: 3, x: 1632, y: 1312, room: 'Sala de Máquinas', rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-infraestructura-f1', role: 'INFRAESTRUCTURA', floor: 1, x: 1888, y: 160, room: 'Depósito de Servicio', rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-infraestructura-f2', role: 'INFRAESTRUCTURA', floor: 2, x: 800, y: 1376, room: 'Sala de Estudio', rewardGaravitos: REWARD_GARAVITOS },
];

export const MISSION_RANGE_PX = 80;
