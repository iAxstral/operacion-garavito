# Tileset Edificio C — Exteriores (Operación Garavito)

Generado de forma procedural (Python + Pillow), siguiendo las mismas reglas
usadas para el tileset del Edificio F, a partir de las fotos reales del
patio del **Edificio Ricardo Quintana Sighinolfi (C)** de la ECI.

## Reglas de la rejilla (no negociables, iguales al Edificio F)

- Tile size: **32x32 px**, sin `margin` ni `spacing`.
- `firstgid = 1`, `gid = id + 1` (el id 0 del tileset es siempre el primer tile del PNG).
- Columnas del atlas: 8 (`columns: 8` en el JSON del tileset).
- El archivo de tileset (`exterior_c_tiles.json`) es un tileset embebido estilo
  Tiled/Phaser, referenciado en el mapa de ejemplo con `firstgid: 1`.
- Los props van en un **atlas aparte** (`exterior_c_props.png/.json`, formato
  Phaser `JSON hash`), para no mezclar tiles de piso/fachada con mobiliario.
- Sufijo `_c` en todos los archivos para que Claude Code pueda cargar ambos
  tilesets (Edificio F y Edificio C) en la misma escena sin colisión de claves:
  `exterior_c_tiles`, `exterior_c_props`.

## Paleta

Se reutiliza como base la paleta ya establecida del juego (oscurecida ~50%
de luminosidad, desaturada, con tinte frío — no se le aplicó ningún filtro
adicional). Los tonos propios del Edificio C, sacados de las fotos del patio
real (ladrillo más cálido/salmón que el resto del campus, columnas color
crema, piso interior en espina de pescado, puerta café, baldosa de baño
color hueso), se añadieron dentro del mismo rango de valor/saturación:

| Rol | Color |
|---|---|
| paver | #cdbcae |
| plaza | #c9c2b6 |
| concreto / concreto oscuro | #a59f90 / #6f6a5c |
| pasto / pasto oscuro | #557a34 / #38542a |
| seto | #4d6a30 |
| vidrio verde | #4f8a84 |
| acero / acero oscuro | #59636b / #2a3036 |
| celosía | #a9aaa4 |
| amarillo escultura | #c9a12a |
| rojo (sombrilla/silla/banca) | #c23030 |
| madera | #8a6440 |
| sangre (decal) | rgb(96,12,12) |
| **ladrillo_c** (propio) | #8a5a48 |
| **ladrillo_c junta** (propio) | #a2927c |
| **columna crema** (propio) | #bdb6a6 |
| **puerta marrón** (propio) | #5c3f2a |
| **terracota piso** (propio) | #9c5a3e |
| **baldosa baño** (propio) | #c7c0ae |

## Tabla de tiles (id / gid / nombre / colisión)

| id | gid | nombre | colisiona |
|---|---|---|---|
| 0 | 1 | paver | no |
| 1 | 2 | paver_var | no |
| 2 | 3 | plaza | no |
| 3 | 4 | concreto | no |
| 4 | 5 | concreto_oscuro | si |
| 5 | 6 | grass1 | no |
| 6 | 7 | grass2 | no |
| 7 | 8 | grass3 | no |
| 8 | 9 | dirt | no |
| 9 | 10 | edge_grass_n | no |
| 10 | 11 | edge_grass_s | no |
| 11 | 12 | edge_grass_e | no |
| 12 | 13 | edge_grass_w | no |
| 13 | 14 | hedge | si |
| 14 | 15 | ladrillo_c | si |
| 15 | 16 | ladrillo_c_zocalo | si |
| 16 | 17 | ventana_sana | si |
| 17 | 18 | ventana_rota | si |
| 18 | 19 | ventana_tapiada | si |
| 19 | 20 | ventana_oscura | si |
| 20 | 21 | columna | si |
| 21 | 22 | puerta_marron | si |
| 22 | 23 | celosia | si |
| 23 | 24 | piso_espina_a | no |
| 24 | 25 | piso_espina_b | no |
| 25 | 26 | piso_recto | no |
| 26 | 27 | baldosa_bano | no |
| 27 | 28 | decal_sangre | no |
| 28 | 29 | decal_grieta | no |
| 29 | 30 | decal_cinta | no |
| 30 | 31 | decal_escombros | no |
| 31 | 32 | decal_maleza | no |
| 32 | 33 | decal_charco | no |

## Receta de fachada del Edificio C

Reconstruida a partir de las fotos del patio en U del Edificio C:

1. **Zócalo de concreto** en la base del muro (`ladrillo_c_zocalo`) — franja
   clara que separa el ladrillo del piso, visible en la foto del patio interior (jardín con agapantos).
2. **Ladrillo cálido** (`ladrillo_c`) como paño principal, con hiladas más
   finas y juntas más claras que el ladrillo genérico del resto del campus.
3. **Columnas crema** (`columna`) cada 5–7 tiles en los corredores porticados
   (vistas en el patio principal y en los pasillos con macetas de bugambilia).
4. **Puerta café** (`puerta_marron`) para accesos de servicio / baños —
   colisiona por defecto; en el juego se puede togglear a "abierta" quitando
   la colisión cuando un jugador interactúa.
5. **Ventanas**: mezcla de `ventana_sana` (vidrio verde intacto, mayoría),
   con `ventana_rota`, `ventana_tapiada` y `ventana_oscura` distribuidas
   como puntos de tensión narrativa (vidrios rotos cerca de zonas de combate,
   tapiadas cerca de refugios, oscuras cerca del jefe).
6. **Celosías** (`celosia`) en los remates de los techos a dos aguas
   (rejillas circulares de ventilación vistas en las fachadas con caballete).
7. Interiores: **piso en espina de pescado** (`piso_espina_a`/`_b`, dos
   variantes para romper el patrón) en pasillos y salas de estudio, y
   **piso recto** (`piso_recto`) en corredores de servicio, con
   **baldosa de baño** (`baldosa_bano`) sólo en los accesos a baños.

## Props (`exterior_c_props.png/.json`)

Mismo diseño visual que el mobiliario urbano del Edificio F, para que ambos
tilesets se vean como parte de un único set de assets:

- `banca_roja`, `sombrilla_roja` — mobiliario del patio central.
- `caneca`, `farola` — equipamiento urbano.
- `arbol`, `busto` — el árbol central del patio y el busto/estatua junto a
  las máquinas expendedoras.
- `maquina_expendedora` — vista en el corredor con ventanales al parqueadero.
- `mesa_redonda`, `silla_negra` — mesas altas con banquitos rojos/negros
  del punto de encuentro bajo la escalera.

## Escala de personajes / anchos de puerta y pasillo

Los pasillos del Edificio C en las fotos rondan **4–5 tiles de ancho**
(128–160 px) y las puertas de servicio **1 tile** (32 px) de vano libre.
Para que el jefe zombi "ingeniero de sistemas" (traje + corbata
ensangrentada) y el zombi guardia de seguridad puedan perseguir sin
atascarse:

- Pasillos jugables: **mínimo 4 tiles** de ancho libre (evitar cuellos de
  botella de 1 tile salvo en puertas puntuales).
- Vanos de puerta: **1 tile** de ancho, pero flanqueados por columnas/zócalo
  sin colisión extra en las esquinas, para no recortar la hitbox del jefe.
- El patio central (plaza) se dejó abierto (sin props en el centro) para
  dar espacio de maniobra en el enfrentamiento con el jefe.

## Carga en Phaser (snippet)

```js
// preload
this.load.image('exterior_c_tiles', 'assets/tiles/exterior_c_tiles.png');
this.load.tilemapTiledJSON('exterior_c_map', 'assets/tiles/exterior_c_map_example.json');
this.load.atlas('exterior_c_props', 'assets/tiles/exterior_c_props.png', 'assets/tiles/exterior_c_props.json');

// create
const map = this.make.tilemap({ key: 'exterior_c_map' });
const tileset = map.addTilesetImage('exterior_c_tiles', 'exterior_c_tiles', 32, 32, 0, 0);

const ground = map.createLayer('ground', tileset, 0, 0);
const facade = map.createLayer('facade', tileset, 0, 0);
const decals = map.createLayer('decals', tileset, 0, 0);

facade.setCollisionByProperty({ colisiona: true });

// props desde el object layer (capa "props")
map.getObjectLayer('props').objects.forEach(obj => {
  const spriteName = obj.properties.find(p => p.name === 'sprite').value;
  this.physics.add.staticImage(obj.x, obj.y, 'exterior_c_props', spriteName);
});

this.physics.add.collider(player, facade);
```

## Entregables

- `exterior_c_tiles.png` / `exterior_c_tiles.json` — tileset 32x32 (33 tiles).
- `exterior_c_props.png` / `exterior_c_props.json` — atlas de props (formato hash).
- `exterior_c_map_example.json` — mapa de ejemplo (capas ground/facade/decals/props/lights).
- `exterior_c_preview_raw.png` — preview del mapa sin ambientación.
- `exterior_c_preview_ambient.png` — preview con velo nocturno + luces de farola/ventana.
- `exterior_c_contact_sheet.png` — hoja de contacto de los 33 tiles con id/nombre.
- Este archivo (`EXTERIOR_C_TILES.md`).

## Nota de verificación

Se revisó visualmente el contact sheet, el preview crudo y el preview con
ambiente antes de entregar. Durante la verificación se encontró y corrigió
un bug de generación (un `rectangle(..., fill=None)` sin `outline` que en
esta versión de Pillow dibuja un contorno blanco por defecto) que dejaba una
franja blanca espuria en `edge_grass_n`; el tileset entregado ya no la tiene.

**Pendiente para ti**: los props se diseñaron para *coincidir en estilo* con
los del Edificio F siguiendo la paleta y convenciones que me diste, pero no
tengo en este chat los archivos originales de props del F para verificar
pixel a pixel que sean idénticos. Si tienes `exterior_f_props.png/json` a
la mano, compártelos y ajusto `exterior_c_props` para que sean el mismo
spritesheet reutilizado (no una reinterpretación).
