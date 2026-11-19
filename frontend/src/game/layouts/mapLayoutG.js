import {
  FOUR_CHAIRS,
  FURNITURE_COLORS,
  ROOM_BOTTOM_LEFT,
  ROOM_BOTTOM_RIGHT,
  ROOM_TOP_LEFT,
  ROOM_TOP_RIGHT,
  TWO_CHAIRS,
  createCampusBuilding,
  tableWithChairs,
  tiles,
} from './campusBuilding.js';

// Edificio G (Ingeniería): 2 pisos de laboratorios y talleres. La cafetería (piso 1) y
// la armería (piso 2) están donde el juego pone a la vendedora y a la máquina de armas.
const building = createCampusBuilding({
  prefix: 'g',
  floors: {
    1: {
      name: 'Piso 1',
      rooms: [
        {
          ...ROOM_TOP_LEFT,
          id: 'computo',
          label: 'Sala de Cómputo',
          furniture: () => [
            ...tiles([8, 10, 12], [3, 5], 36, 24, FURNITURE_COLORS.machine),
            ...tiles([8, 10, 12], [4], 20, 12, FURNITURE_COLORS.chair),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'suelos',
          label: 'Laboratorio de Suelos',
          furniture: () => [
            ...tiles([24, 26, 28, 30], [3], 40, 26, FURNITURE_COLORS.bench),
            ...tiles([24, 30], [5], 40, 26, FURNITURE_COLORS.crate),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'modelos',
          label: 'Taller de Modelos',
          furniture: () => [
            ...tableWithChairs(8, 18, 40, FOUR_CHAIRS, FURNITURE_COLORS.desk),
            ...tableWithChairs(11, 20, 40, FOUR_CHAIRS, FURNITURE_COLORS.desk),
          ],
        },
        {
          ...ROOM_BOTTOM_RIGHT,
          id: 'cafeteria',
          label: 'Cafetería',
          furniture: () => [24, 30].flatMap((col) =>
            [18, 21].flatMap((row) => tableWithChairs(col, row, 32, TWO_CHAIRS, FURNITURE_COLORS.cafeTable)),
          ),
        },
      ],
    },
    2: {
      name: 'Piso 2',
      rooms: [
        {
          ...ROOM_TOP_LEFT,
          id: 'hidraulica',
          label: 'Laboratorio de Hidráulica',
          furniture: () => [
            ...tiles([7, 8], [3], 60, 30, FURNITURE_COLORS.machine),
            ...tiles([11, 12], [5], 60, 30, FURNITURE_COLORS.bench),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'proyectos',
          label: 'Sala de Proyectos',
          furniture: () => [
            ...tiles([25, 26, 27, 28], [4], 60, 44, FURNITURE_COLORS.table),
            ...tiles([25, 26, 27, 28], [3, 5], 30, 12, FURNITURE_COLORS.chair),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'planos',
          label: 'Archivo de Planos',
          furniture: () => [
            ...tiles([7, 8, 11, 12], [17], 56, 22, FURNITURE_COLORS.shelf),
            ...tiles([7, 8, 11, 12], [21], 56, 22, FURNITURE_COLORS.shelf),
          ],
        },
        {
          ...ROOM_BOTTOM_RIGHT,
          id: 'armeria',
          label: 'Armería',
          furniture: () => [
            ...tiles([24, 25, 26], [17], 56, 24, FURNITURE_COLORS.rack),
            ...tiles([24, 25, 26, 28, 29, 30, 31], [22], 56, 24, FURNITURE_COLORS.rack),
            ...tiles([30, 31], [20, 21], 44, 40, FURNITURE_COLORS.crate),
          ],
        },
      ],
    },
  },
});

export const FLOOR_COUNT = building.FLOOR_COUNT;
export const buildFloorLayout = building.buildFloorLayout;
