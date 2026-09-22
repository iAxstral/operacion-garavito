# Escena jugable del Edificio C — piso 1

Este documento explica cómo quedó construido el piso 1 dentro del juego (no
Tiled: el proyecto genera el mapa con código en `frontend/src/game/mapLayout.js`
y lo dibuja con `frontend/src/game/MainScene.js` y `frontend/src/game/outsideDecor.js`,
usando los frames de `exterior_c_tiles.png` / `exterior_c_props.png`).

## Por qué es "el piso 1 compartido" y no un edificio aparte

El backend (`backend/src/main/java/.../FloorGrid.java`) no tiene concepto de
"edificio": solo conoce 3 pisos (`floor1.grid`, `floor2.grid`, `floor3.grid`),
generados automáticamente desde `mapLayout.js` con
`frontend/scripts/export-floor-grid.mjs`. Los botones "F" y "C" del menú de
selección llevan al mismo mundo — es la única opción técnica hoy sin tocar el
backend Java. Este documento describe cómo se transformó **ese** piso 1 para
que se vea y se juegue como el Edificio C real. Ampliar esto a un mundo
totalmente aparte por edificio es un cambio de arquitectura backend mayor,
fuera de este alcance (quedó como opción descartada, ver conversación).

## Zona por zona

| # | Zona de la foto | Dónde vive en el juego | Qué se implementó | Qué se simplificó |
|---|---|---|---|---|
| 1 | Patio central con 3 farolas y bancas rojas, centro circular con 4 árboles | Salón central del piso 1 (`buildCourtyard`, columnas 10–21, filas 3–20) | Un cuarto abierto de 12×18 tiles (mucho más ancho que el mínimo de 4 tiles) conectado a los dos brazos del vestíbulo por las filas 10–13, sin ningún muro entre medio — se puede cruzar de un lado al otro. Piso en espina de pescado, columnas de pórtico en dos hileras, **4 árboles en cruz** (norte/sur/este/oeste) exactamente en el centro, 3 farolas y 4 bancas rojas alrededor, una mesa con sillas junto al fondo | Las salas "Sala de Estudio" y "Terraza" (las dos de la izquierda) se angostaron de 8 a 7 columnas para dejar libre el espacio del salón central — sus muebles se reacomodaron dentro de esa medida menor |
| 2 | Fachada de dos pisos, columnas cada 5–7 tiles, ventanas variadas | Muros exteriores de todas las salas y del vestíbulo (`renderFacade` en `outsideDecor.js`) | Columnas crema cada 6 tiles, ventanas sanas/rotas/tapiadas/oscuras repartidas al azar (12% de puntos de tensión), zócalo claro en la base | Es un solo nivel visual (no hay un segundo piso real con su propio corredor); la "fachada de dos pisos" se sugiere con columnas + remate, no se modela en altura |
| 3 | Corredor porticado con piso en espina de pescado y columna de concreto | El mismo vestíbulo central | Piso en espina de pescado en las 4 filas caminables, columnas cada 6 tiles (mismas de la zona 1, tintadas crema), luces fluorescentes fijas en el techo (`Lighting.addLight` con `bulb:false`, sin bombillo visible, sin parpadeo) reutilizando el sistema de luces ya existente | Sin sprite de luminaria de techo (solo el resplandor); no hay barandal de segundo piso |
| 4 | Vestíbulo de la torre con escalera de ladrillo y mesas altas | Los dos bloques de escalera del piso 1 (subir/bajar) | Mesa redonda + 2 sillas negras junto a cada hueco de escalera (`plaza-table`) | La escalera sigue siendo el sprite genérico `v2_escalera` (no se re-texturizó a ladrillo por falta de un tile de escalera propio en el set C) |
| 5 | Sala de estudio con mesas en fila y ventanales al parqueadero | Sala superior izquierda, ahora `id: 'estudio-c'`, label "Sala de Estudio" | 3 filas de mesas con sillas a los lados; su muro exterior (el que da "afuera") ya recibe ventanas variadas automáticamente por `renderFacade` | No hay vista real a buses/parqueadero (el "afuera" es el jardín/exterior genérico del mapa) |
| 6 | Nicho de baños con puerta café, pictogramas y cámara | Extremo izquierdo del vestíbulo, piso 1 (antes solo tenía baldosa y una banca) | Baldosa hueso (`setBathFloor`), tile `puerta_marron` como decoración visual (`bath-door`), pictogramas 🚹/🚺 (`pictogram`) y una cámara 📷 en la esquina (`camera`) | La puerta es decorativa, no tiene mecánica de abrir/cerrar (esa mecánica está atada al sprite `v2_door_madera` en otras puertas del juego; cambiarla habría roto ese sistema) |
| 7 | Pasillo trasero de servicio con carrito de aseo | Sala superior derecha, ahora `id: 'deposito'`, label "Depósito de Servicio" | Cajas/bultos apilados (stand-in de desorden y abandono) | No hay sprite de carrito de aseo ni decals de sangre/charco sobre el piso (el sistema de piso interior no soporta una capa de decals separada todavía); tampoco se angostó a 2–3 tiles porque ya era una sala de 10×7 |
| 8 | Jardín lateral con muro y vista lejana | Todo el margen exterior del mapa (`outsideDecor.js`, ya existía de una iteración anterior) | Pasto, setos con toques de buganvilia, árboles, montañas de fondo | Sin buses ni calle visibles; es fondo genérico de campus |

## Qué NO se movió (a propósito)

La sala de la esquina inferior derecha (`id: 'cafeteria'`) y sus coordenadas
**no se tocaron**: ahí vive la misión de Economía, la vendedora y los 4 items
de comida, con las mismas coordenadas que ya conoce
`backend/src/main/java/.../MissionCatalog.java`. Moverla habría exigido
sincronizar 4 archivos (2 catálogos de frontend + el catálogo de backend +
el grid) sin forma de probarlo en vivo esta sesión — se dejó igual para no
arriesgar romper esa misión para el equipo.

## Colisión y backend

- Esta vez sí cambió la forma real del piso 1: las salas izquierdas se
  angostaron (de `x=6,w=8` a `x=3,w=7`, ver `ROOM_TOP_LEFT_C` /
  `ROOM_BOTTOM_LEFT_C` en `mapLayout.js`, solo usadas en el piso 1 — los
  pisos 2 y 3 siguen con las salas genéricas originales, sin tocar) para
  abrir la columna 10–21 donde vive el salón central (`buildCourtyard`).
  Antes esas dos salas terminaban en la columna 13/14; ahora terminan en
  la 9, exactamente donde ya estaba `COL_LEFT` (la columna de la puerta),
  así que la puerta sigue funcionando igual, solo la sala es más angosta.
- Por eso se regeneró `backend/src/main/resources/floor1.grid` corriendo
  `node frontend/scripts/export-floor-grid.mjs`. Revisé el diff a mano
  (16 de 30 filas cambian): la doble pared sólida que antes separaba las
  columnas 9–22 se reemplaza por el salón abierto; las filas 10–13 (el
  corredor que cruza de lado a lado) **no cambiaron**, siguen siendo
  caminables de punta a punta como antes.
- Los props (farolas, columnas, bancas, mesas, los 4 árboles) son sólidos
  del lado del cliente (`this.solids`) pero el backend no los conoce —
  **esto ya pasaba antes** con las columnas y bancas del vestíbulo original
  (el backend nunca tuvo esa información), así que no es una inconsistencia
  nueva. Cada árbol bloquea un solo tile y están separados por dos tiles
  entre sí (a 2 de distancia del centro), así que el jefe zombi tiene de
  sobra para rodearlos por cualquier lado; el salón entero es mucho más
  ancho que el mínimo de 4 tiles en toda su extensión, no solo en el borde.

## Verificación

- `npx eslint` sobre los 3 archivos tocados: sin errores nuevos (el único
  error de lint reportado, en `mapLayout.js:86`, ya existía antes de este
  cambio y no se tocó).
- `npm run build`: compila sin errores.
- Diff de `floor1.grid` revisado a mano línea por línea (ver arriba).
- Además de leer el diff, corrí `buildFloorLayout({floor:1})` directamente
  con Node (sin navegador) y consulté el tipo de celda columna por columna
  en las filas clave (9, 10, 13, 14, 4, 19) para confirmar que las filas
  10–13 quedan sin ningún muro entre la columna 0 y la 34, y que las
  paredes del salón central caen exactamente donde se calcularon
  (`COURTYARD_X0=10`, `COURTYARD_X1=21`). Los 4 árboles salieron en
  `(15.5, 9.5)`, `(15.5, 13.5)`, `(13.5, 11.5)`, `(17.5, 11.5)` — una cruz
  de 2 tiles de radio alrededor del centro `(15.5, 11.5)`, como se pedía.
- **No se pudo verificar con el navegador ni con el backend Java en esta
  sesión**: la máquina quedó con memoria crítica (~30 MB libres de 7.9 GB)
  durante la sesión de pruebas, y arrancar Chrome o Maven en ese estado
  arriesgaba colgar el equipo. Por favor recarga el juego (`Ctrl+F5`) y
  confirma tú mismo que el patio, las salas renombradas y el nicho de baños
  se ven y funcionan bien antes de dar esto por cerrado — en particular,
  entra a "Sala de Estudio" y "Depósito de Servicio" y confirma que la
  puerta abre/cierra normal (cambió de id pero no de mecánica).
