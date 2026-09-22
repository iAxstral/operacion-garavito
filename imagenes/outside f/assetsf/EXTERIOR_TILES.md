# Edificio F — EXTERIOR: guia de tiles para Claude Code

Basado en las fotos reales del Edificio F (torre de concreto visto con placa "F", fachada de celosias metalicas sobre vidrio verde, alero plano oscuro, adoquin, plaza de concreto, cesped, setos, sombrillas rojas, escultura amarilla, canecas, ajedrez gigante). Estetica: **The Walking Dead / FNAF** (fria, desaturada, oscura).

## 1. Reglas (leer primero)
- **Rejilla uniforme 32x32, sin margin ni spacing** (`exterior_tiles.png`, 8 columnas x 6 filas = 45 tiles). No usar TexturePacker; si hay que agregar tiles se hace en `gen_exterior.py` y se **agregan al final** para no cambiar los gid existentes.
- **gid = id + 1** (0 = vacio). `firstgid = 1`.
- **Perspectiva 3/4:** el piso se ve desde arriba; la fachada se dibuja de frente (como Stardew/Pokemon). Alto de la fachada = 5 filas.
- **Los tiles YA vienen oscuros** (~50% de luminosidad, desaturados, tinte frio). No oscurecerlos mas por tile: la atmosfera final va con overlay + luces (seccion 7b).
- **No cambiar la paleta** (seccion 6). Las sombrillas son rojas **sin logo** a proposito.
- Orden de render: `ground` -> `facade` -> `decals` -> `props` (y-sort por borde inferior: `y + h`) -> luces/oscuridad.

## 2. Archivos
| Archivo | Que es |
|---|---|
| `exterior_tiles.png` / `.json` | Tileset 32x32 (ground + facade + decals). El JSON trae `name`, `layer` y `collides` por tile. |
| `exterior_props.png` / `.json` | Atlas de objetos grandes (formato Phaser JSON-hash, `load.atlas`). |
| `exterior_props_meta.json` | Tamano y `collider` (relativo a la esquina sup-izq del sprite) de cada prop. |
| `exterior_map_example.json` | Mapa de ejemplo 30x17 que replica la vista de las fotos: capas `ground` y `facade` (gids), `decals`, `props`, `lights`. |
| `preview_fachada_raw.png` / `preview_fachada_ambiente.png` | Referencia visual: sin y con iluminacion. **El resultado debe verse como el ambiente.** |
| `gen_exterior.py` | Generador procedural (re-ejecutable, seeds fijos). |

## 3. Tiles (45)
Capas: `ground` = suelo (no colisiona salvo seto), `facade` = pared/vidrio/celosia (colisiona, puerta no), `decal` = overlays transparentes que se dibujan encima del suelo.

| id | gid | nombre | paleta | colisiona |
|---|---|---|---|---|
| 0 | 1 | `paver` | ground | no |
| 1 | 2 | `paver_b` | ground | no |
| 2 | 3 | `paver_dirty` | ground | no |
| 3 | 4 | `paver_cracked` | ground | no |
| 4 | 5 | `plaza` | ground | no |
| 5 | 6 | `plaza_cracked` | ground | no |
| 6 | 7 | `grass_a` | ground | no |
| 7 | 8 | `grass_b` | ground | no |
| 8 | 9 | `grass_dead` | ground | no |
| 9 | 10 | `dirt` | ground | no |
| 10 | 11 | `edge_grass_n` | ground | no |
| 11 | 12 | `edge_grass_s` | ground | no |
| 12 | 13 | `edge_grass_w` | ground | no |
| 13 | 14 | `edge_grass_e` | ground | no |
| 14 | 15 | `hedge` | ground | si |
| 15 | 16 | `hedge_dead` | ground | si |
| 16 | 17 | `concrete_wall` | facade | si |
| 17 | 18 | `concrete_wall_stained` | facade | si |
| 18 | 19 | `concrete_wall_F` | facade | si |
| 19 | 20 | `concrete_slit` | facade | si |
| 20 | 21 | `concrete_base` | facade | si |
| 21 | 22 | `concrete_top` | facade | si |
| 22 | 23 | `roof_edge` | facade | si |
| 23 | 24 | `louver` | facade | si |
| 24 | 25 | `louver_col` | facade | si |
| 25 | 26 | `louver_broken` | facade | si |
| 26 | 27 | `louver_lit` | facade | si |
| 27 | 28 | `slab_rail` | facade | si |
| 28 | 29 | `glass_green` | facade | si |
| 29 | 30 | `glass_cracked` | facade | si |
| 30 | 31 | `glass_boarded` | facade | si |
| 31 | 32 | `glass_dark` | facade | si |
| 32 | 33 | `steel_column` | facade | si |
| 33 | 34 | `door_l` | facade | no |
| 34 | 35 | `door_r` | facade | no |
| 35 | 36 | `shadow_overhang` | decal | no |
| 36 | 37 | `blood_a` | decal | no |
| 37 | 38 | `blood_b` | decal | no |
| 38 | 39 | `blood_drag` | decal | no |
| 39 | 40 | `crack_decal` | decal | no |
| 40 | 41 | `weeds` | decal | no |
| 41 | 42 | `debris` | decal | no |
| 42 | 43 | `leaves` | decal | no |
| 43 | 44 | `puddle` | decal | no |
| 44 | 45 | `tape_h` | decal | no |

Notas: `edge_grass_<n|s|w|e>` = el cesped ocupa ese lado del tile (borde adoquin/pasto). `shadow_overhang` es la sombra rayada del alero, va en la fila justo debajo de la fachada. `door_l` + `door_r` forman la puerta doble (2 tiles de ancho, sin colision: disparador de entrada).

## 4. Receta de la fachada (coordenadas en tiles, origen arriba-izquierda del mapa)
**Torre de concreto (x=0..3, filas 0..4):** fila0 `concrete_top`; fila1 `concrete_wall` (con `concrete_slit` en x=3); fila2 `concrete_wall` con `concrete_wall_F` en x=1; fila3 `concrete_wall` / `concrete_wall_stained` en x=0 y x=2; fila4 `concrete_base`.

**Fachada principal (x=4..21):**
- fila0: `roof_edge` en todo el ancho.
- fila1 y fila3 (pisos altos): `louver_col` en x in {4,7,10,15,18,21} (alineadas con las columnas de abajo), `louver` en el resto. Variantes: `louver_broken` en (9,1) y (16,3); `louver_lit` (luz enfermiza) en (12,1) y (6,3).
- fila2: `slab_rail` en todo el ancho.
- fila4 (planta baja), de x=4 a x=21: `steel_column, glass_green, glass_dark, steel_column, glass_cracked, glass_green, steel_column, glass_boarded, door_l, door_r, glass_green, steel_column, glass_dark, glass_green, steel_column, glass_boarded, glass_green, steel_column`.
- fila5 (suelo frente a la fachada): decal `shadow_overhang` en x=4..21.

**Suelo:** andenes de adoquin (`paver*`) frente al edificio, plaza de concreto (`plaza*`) a la derecha, cesped (`grass_*`) con `edge_grass_*` donde el sendero toca el pasto, setos (`hedge*`) como borde. Ver `exterior_map_example.json` para el layout exacto.

## 5. Props (atlas `exterior_props`)
| nombre | tamano | collider (x,y,w,h) |
|---|---|---|
| `umbrella_table` | 64x64 | x=8 y=44 w=48 h=16 |
| `umbrella_torn` | 64x64 | x=8 y=44 w=48 h=16 |
| `chair_red` | 32x32 | x=8 y=20 w=16 h=10 |
| `chair_fallen` | 32x32 | x=4 y=18 w=24 h=12 |
| `bench` | 64x32 | x=4 y=14 w=56 h=14 |
| `sculpture_yellow` | 64x96 | x=14 y=74 w=36 h=16 |
| `palm` | 64x64 | x=26 y=50 w=12 h=10 |
| `tree` | 96x128 | x=40 y=100 w=16 h=18 |
| `tree_dead` | 96x128 | x=40 y=100 w=16 h=18 |
| `bins` | 32x32 | x=2 y=14 w=28 h=14 |
| `chess_king` | 32x32 | x=8 y=20 w=16 h=10 |
| `chess_pawn` | 32x32 | x=8 y=20 w=16 h=10 |
| `barricade` | 64x32 | x=0 y=12 w=64 h=18 |
| `lamp` | 32x64 | x=11 y=52 w=10 h=8 |

## 6. Paleta (ya oscurecida)
| uso | color |
|---|---|
| paver (adoquin) | `#606163` |
| mortero | `#464646` |
| plaza concreto | `#5c6062` |
| concreto visto | `#4b4e4f` |
| concreto oscuro | `#2a2c2b` |
| pasto | `#34462d` |
| pasto oscuro | `#233022` |
| seto | `#293624` |
| vidrio verde | `#385457` |
| acero | `#343c43` |
| acero oscuro | `#181c20` |
| celosia | `#565c60` |
| amarillo escultura | `#796f3d` |
| rojo sombrilla/silla | `#61292c` |
| madera | `#473c32` |
| vacio interior | `#090d0f` |
| sangre | `#600c0c` |

## 7. Cargar en Phaser 3
```js
// preload
this.load.spritesheet('ext_sheet', 'assets/exterior/exterior_tiles.png', { frameWidth: 32, frameHeight: 32 });
this.load.image('ext_tiles', 'assets/exterior/exterior_tiles.png');
this.load.atlas('ext_props', 'assets/exterior/exterior_props.png', 'assets/exterior/exterior_props.json');
this.load.json('ext_tileset', 'assets/exterior/exterior_tiles.json');
this.load.json('ext_props_meta', 'assets/exterior/exterior_props_meta.json');
this.load.json('ext_map', 'assets/exterior/exterior_map_example.json');

// create
const data = this.cache.json.get('ext_map');
const solid = this.cache.json.get('ext_tileset').tiles.filter(t => t.collides).map(t => t.gid);
const map = this.make.tilemap({ tileWidth: 32, tileHeight: 32, width: data.width, height: data.height });
const ts = map.addTilesetImage('ext_tiles', 'ext_tiles', 32, 32, 0, 0, 1); // firstgid = 1
const ground = map.createBlankLayer('ground', ts).setDepth(0);
const facade = map.createBlankLayer('facade', ts).setDepth(1);
data.layers.ground.forEach((row, y) => row.forEach((g, x) => g && ground.putTileAt(g, x, y)));
data.layers.facade.forEach((row, y) => row.forEach((g, x) => g && facade.putTileAt(g, x, y)));
ground.setCollision(solid); facade.setCollision(solid);

data.decals.forEach(d => this.add.image(d.x * 32, d.y * 32, 'ext_sheet', d.gid - 1).setOrigin(0).setDepth(2));
data.props.forEach(p => this.add.image(p.x, p.y, 'ext_props', p.name).setOrigin(0).setDepth(10 + p.y + p.h));
// colliders: crear cuerpos estaticos con exterior_props_meta.json (x,y,w,h relativos al sprite)
```

## 7b. Ambiente (lo que da el look TWD/FNAF)
- Luz ambiente fria y baja: `this.lights.enable().setAmbientColor(0x6b7a9e)` y `setPipeline('Light2D')` en capas, decals y props.
- Luces desde `data.lights` (`addLight(x, y, radius, color, intensity)`): farolas calidas, ventanas verdosas, luz de emergencia roja en la puerta.
- Parpadeo: tween aleatorio de `intensity` (0.3–1.0) en las farolas, con pausas largas; una de ellas debe fallar de vez en cuando.
- Viñeta oscura en los bordes de la camara. Referencia exacta: `preview_fachada_ambiente.png`.

## 8. Que NO hacer
- No reescalar los tiles con suavizado (usar `pixelArt: true` / NEAREST).
- No mezclar el tileset con otros de tamano distinto en la misma hoja.
- No reordenar tiles existentes; solo agregar al final.
