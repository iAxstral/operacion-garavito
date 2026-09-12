/**
 * Catalogo fijo de items recolectables del piso 1 (los 4 placeholder de
 * comida en la Cafeteria). Debe coincidir exactamente con
 * backend/.../game/WorldItemCatalog.java (itemId, tipo y posicion en px)
 * — duplicado a proposito por ahora, ver ARCHITECTURE.md.
 */
export const FOOD_ITEMS = [
  { itemId: 'cafeteria-food-1', type: 'FOOD', itemName: 'Sándwich', x: 1632, y: 1248 },
  { itemId: 'cafeteria-food-2', type: 'FOOD', itemName: 'Fruta', x: 1888, y: 1248 },
  { itemId: 'cafeteria-food-3', type: 'FOOD', itemName: 'Agua', x: 1632, y: 1440 },
  { itemId: 'cafeteria-food-4', type: 'FOOD', itemName: 'Barra energética', x: 1888, y: 1440 },
];

// Radio (px) dentro del cual el cliente ofrece el pickup. Debe ser igual o
// mas chico que PICKUP_RANGE_PX en GameSession.java (110px) para que el
// backend nunca rechace por distancia un pickup que el cliente ya acepto.
export const PICKUP_RANGE_PX = 90;
