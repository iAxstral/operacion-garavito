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

// Edificio A (Administrativo): 3 pisos de oficinas. La cafetería (piso 1) y la
// armería (piso 2) están donde el juego pone a la vendedora y a la máquina de armas.
const building = createCampusBuilding({
  prefix: 'a',
  floors: {
    1: {
      name: 'Piso 1',
      rooms: [
        {
          ...ROOM_TOP_LEFT,
          id: 'registro',
          label: 'Registro Académico',
          furniture: () => tiles([8, 10, 12], [3, 5], 36, 24, FURNITURE_COLORS.desk),
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'tesoreria',
          label: 'Tesorería',
          furniture: () => [
            ...tiles([24, 26, 28, 30], [3], 40, 26, FURNITURE_COLORS.desk),
            ...tiles([24, 30], [5], 40, 26, FURNITURE_COLORS.machine),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'bienestar',
          label: 'Bienestar Universitario',
          furniture: () => [
            ...tableWithChairs(8, 18, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
            ...tableWithChairs(11, 20, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
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
          id: 'decanatura',
          label: 'Decanatura',
          furniture: () => [
            ...tiles([7, 8, 11, 12], [2], 60, 26, FURNITURE_COLORS.shelf),
            ...tiles([8, 11], [4], 52, 30, FURNITURE_COLORS.desk),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'consejo',
          label: 'Sala de Consejo',
          furniture: () => [
            ...tiles([25, 26, 27, 28], [4], 60, 44, FURNITURE_COLORS.table),
            ...tiles([25, 26, 27, 28], [3, 5], 30, 12, FURNITURE_COLORS.chair),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'archivo',
          label: 'Archivo Central',
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
    3: {
      name: 'Piso 3',
      rooms: [
        {
          ...ROOM_TOP_LEFT,
          id: 'rectoria',
          label: 'Rectoría',
          furniture: () => [
            ...tiles([8, 11], [3], 60, 30, FURNITURE_COLORS.desk),
            ...tiles([12], [5], 40, 40, FURNITURE_COLORS.shelf),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'datos',
          label: 'Centro de Datos',
          furniture: () => [
            ...tiles([24, 25, 26, 28, 29, 30], [2], 44, 28, FURNITURE_COLORS.server),
            ...tiles([24, 25, 29, 30], [4], 44, 28, FURNITURE_COLORS.server),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'auditorio',
          label: 'Auditorio Principal',
          furniture: () => [
            ...tiles([8, 9, 10, 11, 12], [17], 56, 22, FURNITURE_COLORS.stage),
            ...tiles([7, 8, 11, 12], [19, 21], 40, 24, FURNITURE_COLORS.seat),
          ],
        },
        {
          ...ROOM_BOTTOM_RIGHT,
          id: 'prensa',
          label: 'Sala de Prensa',
          furniture: () => [
            ...tiles([24, 25, 26], [17], 56, 30, FURNITURE_COLORS.desk),
            ...tiles([28, 29, 30, 31], [22], 56, 30, FURNITURE_COLORS.desk),
          ],
        },
      ],
    },
  },
});

export const FLOOR_COUNT = building.FLOOR_COUNT;
export const buildFloorLayout = building.buildFloorLayout;
