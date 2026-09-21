
export const ROLE_CATALOG = [
  {
    role: 'SEGURIDAD',
    name: 'Seguridad',
    spritePrefix: 'seguridad',
    portrait: '/personajes/seguridad.png',
    mission: 'Armero (piso 2)',
    blurb: 'Vigila las cámaras y mantiene la línea. Su misión está en el Armero.',
  },
  {
    role: 'SALUD',
    name: 'Biomédica',
    spritePrefix: 'biomedica',
    portrait: '/personajes/biomedica.png',
    mission: 'Laboratorio (piso 3)',
    blurb: 'Repara el cableado del laboratorio conectando los cables por color. Su misión está en el piso 3.',
  },
  {
    role: 'ECONOMIA',
    name: 'Economía',
    spritePrefix: 'economia',
    portrait: '/personajes/economia.png',
    mission: 'Cafetería (piso 1)',
    blurb: 'Cuadra las cuentas de la cafetería resolviendo sumas. Su misión está en la Cafetería.',
  },
  {
    role: 'INFRAESTRUCTURA',
    name: 'Infraestructura',
    spritePrefix: 'infraestructura',
    portrait: '/personajes/infraestructura.png',
    mission: 'Sala de Máquinas (piso 3)',
    blurb: 'Levanta una estructura apilando bloques bien alineados. Su misión está en la Sala de Máquinas.',
  },
];

export function roleInfo(role) {
  return ROLE_CATALOG.find((entry) => entry.role === role) ?? ROLE_CATALOG[0];
}
