
export const ROLE_CATALOG = [
  {
    role: 'SEGURIDAD',
    name: 'Seguridad',
    spritePrefix: 'seguridad',
    portrait: '/personajes/seguridad.png',
    mission: 'Armero, Terraza o Sala de Servidores',
    blurb: 'Vigila las cámaras y mantiene la línea. Su misión vive en 3 salas distintas (Armero piso 2, Terraza piso 1 o Sala de Servidores piso 3) — no siempre es la misma.',
  },
  {
    role: 'SALUD',
    name: 'Biomédica',
    spritePrefix: 'biomedica',
    portrait: '/personajes/biomedica.png',
    mission: 'Laboratorio, Sala de Estudio o Biblioteca',
    blurb: 'Repara el cableado conectando los cables por color. Su misión vive en 3 salas distintas (Laboratorio piso 3, Sala de Estudio piso 1 o Biblioteca piso 2) — no siempre es la misma.',
  },
  {
    role: 'ECONOMIA',
    name: 'Economía',
    spritePrefix: 'economia',
    portrait: '/personajes/economia.png',
    mission: 'Cafetería, Sala de Reuniones o Auditorio',
    blurb: 'Cuadra las cuentas resolviendo sumas. Su misión vive en 3 salas distintas (Cafetería piso 1, Sala de Reuniones piso 2 o Auditorio piso 3) — no siempre es la misma.',
  },
  {
    role: 'INFRAESTRUCTURA',
    name: 'Infraestructura',
    spritePrefix: 'infraestructura',
    portrait: '/personajes/infraestructura.png',
    mission: 'Sala de Máquinas, Depósito o Sala de Estudio',
    blurb: 'Levanta una estructura apilando bloques bien alineados. Su misión vive en 3 salas distintas (Sala de Máquinas piso 3, Depósito de Servicio piso 1 o Sala de Estudio piso 2) — no siempre es la misma.',
  },
];

export function roleInfo(role) {
  return ROLE_CATALOG.find((entry) => entry.role === role) ?? ROLE_CATALOG[0];
}
