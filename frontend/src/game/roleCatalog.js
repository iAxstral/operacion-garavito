import { missionZonesFor } from './missionCatalog';

export const ROLE_CATALOG = [
  {
    role: 'SEGURIDAD',
    name: 'Seguridad',
    spritePrefix: 'seguridad',
    portrait: '/personajes/seguridad.png',
    // Objeto que marca sus salas de misión en el mapa (en vez de escribir el nombre del salón).
    missionIcon: '🛡️',
    blurb: 'Vigila las cámaras y mantiene la línea.',
  },
  {
    role: 'SALUD',
    name: 'Biomédica',
    spritePrefix: 'biomedica',
    portrait: '/personajes/biomedica.png',
    missionIcon: '💉',
    blurb: 'Repara el cableado conectando los cables por color.',
  },
  {
    role: 'ECONOMIA',
    name: 'Economía',
    spritePrefix: 'economia',
    portrait: '/personajes/economia.png',
    missionIcon: '🧮',
    blurb: 'Cuadra las cuentas resolviendo sumas.',
  },
  {
    role: 'INFRAESTRUCTURA',
    name: 'Infraestructura',
    spritePrefix: 'infraestructura',
    portrait: '/personajes/infraestructura.png',
    missionIcon: '🧱',
    blurb: 'Levanta una estructura apilando bloques bien alineados.',
  },
];

// Salas de mision del rol en ese edificio, derivadas del catalogo de misiones para que
// el texto nunca diga salas que el edificio no tiene.
export function missionSummary(role, building) {
  const zones = missionZonesFor(building).filter((zone) => zone.role === role);
  return zones.map((zone) => `${zone.room} (piso ${zone.floor})`).join(' o ');
}

export function roleInfo(role) {
  return ROLE_CATALOG.find((entry) => entry.role === role) ?? ROLE_CATALOG[0];
}
