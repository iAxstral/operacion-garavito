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

// Edificio B (Ciencias Básicas): 3 pisos de laboratorios y aulas. La cafetería (piso 1)
// y la armería (piso 2) están donde el juego pone a la vendedora y a la máquina de armas.
const building = createCampusBuilding({
  prefix: 'b',
  floors: {
    1: {
      name: 'Piso 1',
      rooms: [
        {
          ...ROOM_TOP_LEFT,
          id: 'fisica',
          label: 'Laboratorio de Física',
          furniture: () => [
            ...tiles([7, 8, 11, 12], [3], 56, 26, FURNITURE_COLORS.bench),
            ...tiles([8, 11], [5], 36, 24, FURNITURE_COLORS.machine),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'quimica',
          label: 'Laboratorio de Química',
          furniture: () => [
            ...tiles([24, 25, 26, 28, 29, 30], [3], 56, 26, FURNITURE_COLORS.bench),
            ...tiles([31], [5], 40, 40, FURNITURE_COLORS.shelf),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'aula101',
          label: 'Aula 101',
          furniture: () => [
            ...tiles([7, 9, 11], [18, 20], 40, 24, FURNITURE_COLORS.desk),
            ...tiles([7, 9, 11], [19, 21], 20, 12, FURNITURE_COLORS.chair),
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
          id: 'biologia',
          label: 'Laboratorio de Biología',
          furniture: () => [
            ...tiles([7, 8, 11, 12], [3], 56, 26, FURNITURE_COLORS.bench),
            ...tiles([7, 12], [5], 40, 40, FURNITURE_COLORS.crate),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'matematicas',
          label: 'Sala de Matemáticas',
          furniture: () => [
            ...tableWithChairs(25, 4, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
            ...tableWithChairs(29, 4, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'profesores',
          label: 'Salón de Profesores',
          furniture: () => [
            ...tiles([8, 11], [18], 60, 30, FURNITURE_COLORS.desk),
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
          id: 'observatorio',
          label: 'Observatorio',
          furniture: () => [
            ...tiles([9, 10], [3], 60, 60, FURNITURE_COLORS.machine),
            ...tiles([7, 12], [5], 30, 12, FURNITURE_COLORS.chair),
          ],
        },
        {
          ...ROOM_TOP_RIGHT,
          id: 'electronica',
          label: 'Laboratorio de Electrónica',
          furniture: () => [
            ...tiles([24, 25, 26, 28, 29, 30], [3], 44, 28, FURNITURE_COLORS.machine),
            ...tiles([24, 25, 26, 28, 29, 30], [4], 20, 12, FURNITURE_COLORS.chair),
          ],
        },
        {
          ...ROOM_BOTTOM_LEFT,
          id: 'reactivos',
          label: 'Depósito de Reactivos',
          furniture: () => [
            ...tiles([7, 8, 11, 12], [17], 56, 22, FURNITURE_COLORS.shelf),
            ...tiles([7, 8, 11, 12], [21], 44, 40, FURNITURE_COLORS.crate),
          ],
        },
        {
          ...ROOM_BOTTOM_RIGHT,
          id: 'tutorias',
          label: 'Sala de Tutorías',
          furniture: () => [
            ...tableWithChairs(25, 18, 40, FOUR_CHAIRS, FURNITURE_COLORS.desk),
            ...tableWithChairs(29, 21, 40, FOUR_CHAIRS, FURNITURE_COLORS.desk),
          ],
        },
      ],
    },
  },
});

export const FLOOR_COUNT = building.FLOOR_COUNT;
export const buildFloorLayout = building.buildFloorLayout;
