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

// Biblioteca: 2 pisos de estantes y salas de lectura. La cafetería (piso 1) y la
// armería (piso 2) están donde el juego pone a la vendedora y a la máquina de armas.
const building = createCampusBuilding({
  prefix: 'bib',
  floors: {
    1: {
      name: 'Piso 1',
      rooms: [
        {
          ...ROOM_TOP_LEFT,
          id: 'prestamo',
          label: 'Préstamo y Devolución',
          furniture: () => [
            ...tiles([8, 9, 10, 11], [4], 56, 26, FURNITURE_COLORS.desk),
            ...tiles([7, 12], [2], 56, 22, FURNITURE_COLORS.shelf),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'hemeroteca',
          label: 'Hemeroteca',
          furniture: () => [
            ...tiles([24, 25, 26, 28, 29, 30, 31], [2], 56, 22, FURNITURE_COLORS.shelf),
            ...tiles([25, 29], [5], 40, 40, FURNITURE_COLORS.table),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'lectura',
          label: 'Sala de Lectura',
          furniture: () => [
            ...tableWithChairs(8, 18, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
            ...tableWithChairs(11, 21, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
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
          id: 'especiales',
          label: 'Colecciones Especiales',
          furniture: () => [
            ...tiles([7, 8, 11, 12], [2], 56, 22, FURNITURE_COLORS.shelf),
            ...tiles([7, 8, 11, 12], [5], 56, 22, FURNITURE_COLORS.shelf),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'estudio',
          label: 'Sala de Estudio Grupal',
          furniture: () => [
            ...tiles([25, 26, 27, 28], [4], 60, 44, FURNITURE_COLORS.table),
            ...tiles([25, 26, 27, 28], [3, 5], 30, 12, FURNITURE_COLORS.chair),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'historico',
          label: 'Archivo Histórico',
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
