/**
 * Catalogo fijo de las 4 zonas de mision (una por rol). Debe coincidir
 * exactamente con backend/.../game/MissionCatalog.java (missionId, rol,
 * posicion, recompensa).
 */
export const REWARD_GARAVITOS = 25;

export const MISSION_ZONES = [
  { missionId: 'mission-seguridad', role: 'SEGURIDAD', x: 160, y: 736, rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-salud', role: 'SALUD', x: 736, y: 224, rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-economia', role: 'ECONOMIA', x: 1632, y: 1312, rewardGaravitos: REWARD_GARAVITOS },
  { missionId: 'mission-infraestructura', role: 'INFRAESTRUCTURA', x: 2080, y: 736, rewardGaravitos: REWARD_GARAVITOS },
];

// Radio (px) del overlap que completa la mision automaticamente al pisarla.
// Debe ser igual o mas chico que MISSION_RANGE_PX en GameSession.java (90px).
export const MISSION_RANGE_PX = 80;
