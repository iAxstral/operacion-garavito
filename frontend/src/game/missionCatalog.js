// Espejo de backend/.../MissionType.java y MissionCatalog.java. Las misiones de cada
// jugador las reparte el servidor (3 por Kinder); aqui solo esta como mostrarlas.

export const MISSIONS_PER_KINDER = 3;
export const MISSION_RANGE_PX = 80;

export const MISSION_TYPES = {
  CAMARAS: { role: 'SEGURIDAD', name: 'Cámaras de seguridad', icon: '📹', action: 'Revisar las cámaras' },
  CODIGO: { role: 'SEGURIDAD', name: 'Código de acceso', icon: '🔐', action: 'Reprogramar la cerradura' },
  CABLES: { role: 'SALUD', name: 'Cableado del equipo médico', icon: '🔌', action: 'Reparar el cableado' },
  VACUNA: { role: 'SALUD', name: 'Preparar la vacuna', icon: '💉', action: 'Mezclar la vacuna' },
  CUENTAS: { role: 'ECONOMIA', name: 'Cuentas de la caja', icon: '🧮', action: 'Hacer las cuentas' },
  CAJA: { role: 'ECONOMIA', name: 'Dar el cambio', icon: '💵', action: 'Dar el cambio exacto' },
  TORRE: { role: 'INFRAESTRUCTURA', name: 'Levantar la estructura', icon: '🧱', action: 'Apilar los bloques' },
  FUSIBLES: { role: 'INFRAESTRUCTURA', name: 'Tablero de fusibles', icon: '⚡', action: 'Restablecer los fusibles' },
};

export function missionType(type) {
  return MISSION_TYPES[type] ?? { role: null, name: 'Misión', icon: '❔', action: 'Hacer la misión' };
}

export function missionTypesForRole(role) {
  return Object.entries(MISSION_TYPES)
    .filter(([, info]) => info.role === role)
    .map(([type, info]) => ({ type, ...info }));
}

// Salas donde pueden tocar misiones (para iluminarlas); las coordenadas de cada mision
// asignada llegan del servidor.
const SITES_BY_BUILDING = {
  F: [
    { siteId: 'f1-aula-f-104', room: 'Aula F-104', floor: 1, x: 608, y: 288 },
    { siteId: 'f1-sala-de-profesores', room: 'Sala de Profesores', floor: 1, x: 1760, y: 288 },
    { siteId: 'f1-terraza', room: 'Terraza', floor: 1, x: 608, y: 1248 },
    { siteId: 'f1-cafeteria', room: 'Cafetería', floor: 1, x: 1760, y: 1248 },
    { siteId: 'f2-biblioteca', room: 'Biblioteca', floor: 2, x: 608, y: 288 },
    { siteId: 'f2-sala-de-reuniones', room: 'Sala de Reuniones', floor: 2, x: 1888, y: 288 },
    { siteId: 'f2-sala-de-estudio', room: 'Sala de Estudio', floor: 2, x: 608, y: 1248 },
    { siteId: 'f2-armero', room: 'Armero', floor: 2, x: 1760, y: 1248 },
    { siteId: 'f3-laboratorio-biomedico', room: 'Laboratorio Biomédico', floor: 3, x: 608, y: 288 },
    { siteId: 'f3-sala-de-servidores', room: 'Sala de Servidores', floor: 3, x: 1760, y: 288 },
    { siteId: 'f3-auditorio', room: 'Auditorio', floor: 3, x: 608, y: 1248 },
    { siteId: 'f3-sala-de-maquinas', room: 'Sala de Máquinas', floor: 3, x: 1760, y: 1248 },
  ],
  C: [
    { siteId: 'c1-sala-de-estudio', room: 'Sala de Estudio', floor: 1, x: 416, y: 288 },
    { siteId: 'c1-deposito-de-servicio', room: 'Depósito de Servicio', floor: 1, x: 1760, y: 288 },
    { siteId: 'c1-terraza', room: 'Terraza', floor: 1, x: 416, y: 1248 },
    { siteId: 'c1-cafeteria', room: 'Cafetería', floor: 1, x: 1760, y: 1248 },
    { siteId: 'c2-biblioteca', room: 'Biblioteca', floor: 2, x: 608, y: 288 },
    { siteId: 'c2-sala-de-reuniones', room: 'Sala de Reuniones', floor: 2, x: 1888, y: 288 },
    { siteId: 'c2-sala-de-estudio', room: 'Sala de Estudio', floor: 2, x: 608, y: 1248 },
    { siteId: 'c2-armero', room: 'Armero', floor: 2, x: 1760, y: 1248 },
  ],
};

export function missionSitesFor(building) {
  return SITES_BY_BUILDING[building] ?? SITES_BY_BUILDING.F;
}
