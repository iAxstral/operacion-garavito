import { missionTypesForRole } from './missionCatalog';

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
    blurb: 'La única que puede revivir a los compañeros caídos.',
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

// Minijuegos del rol: cada Kinder le tocan 3 misiones mezclando estos, en salas al azar.
export function missionSummary(role) {
  return missionTypesForRole(role).map((type) => `${type.icon} ${type.name}`).join(' · ');
}

export function roleInfo(role) {
  return ROLE_CATALOG.find((entry) => entry.role === role) ?? ROLE_CATALOG[0];
}
