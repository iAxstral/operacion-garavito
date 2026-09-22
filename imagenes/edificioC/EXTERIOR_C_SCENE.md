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
| 1 | Patio central con 3 farolas y bancas rojas | Vestíbulo central (`hub`, filas 10–13, piso 1 únicamente) | Piso en espina de pescado (`setHerringboneFloor`), 3 farolas en triángulo siempre encendidas (`plaza-lamp`, luz fija sin parpadeo — es el único rincón "seguro"), árbol/jardinera central con colisión pequeña (`plaza-tree`), 4 bancas rojas alrededor (`plaza-bench`) | No es un patio circular real: el vestíbulo sigue siendo un corredor recto de 40×6 tiles (limitación del sistema de salas actual). Las farolas/bancas están distribuidas dentro de ese rectángulo, no en círculo |
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

- Las salas/paredes/puertas interactivas (paredes tipo `wall`/`glass`) **no
  cambiaron de forma**, solo se renombraron dos salas (`aula`→`estudio-c`,
  `profesores`→`deposito`), lo que cambió sus `doorId`
  (`f1-aula`→`f1-estudio-c`, `f1-profesores`→`f1-deposito`).
- Por eso se regeneró `backend/src/main/resources/floor1.grid` corriendo
  `node frontend/scripts/export-floor-grid.mjs`. El diff resultante son
  **solo esas dos líneas de puerta**; el resto del mapa (muros, piso,
  ancho de pasillos) es idéntico al de antes.
- Los props nuevos (farolas, árbol, bancas, mesas) son sólidos del lado del
  cliente (`this.solids`) pero el backend no los conoce — **esto ya pasaba
  antes** con las columnas y bancas existentes (el backend nunca tuvo esa
  información), así que no es una inconsistencia nueva que yo haya
  introducido.
- El árbol central del patio es el único prop nuevo con colisión; se dejó
  de un tile para no cerrar el paso — el vestíbulo sigue teniendo 4 filas
  caminables de alto en todo su ancho.

## Verificación

- `npx eslint` sobre los 3 archivos tocados: sin errores nuevos (el único
  error de lint reportado, en `mapLayout.js:86`, ya existía antes de este
  cambio y no se tocó).
- `npm run build`: compila sin errores.
- Diff de `floor1.grid` revisado a mano línea por línea (ver arriba).
- **No se pudo verificar con el navegador ni con el backend Java en esta
  sesión**: la máquina quedó con memoria crítica (~30 MB libres de 7.9 GB)
  durante la sesión de pruebas, y arrancar Chrome o Maven en ese estado
  arriesgaba colgar el equipo. Por favor recarga el juego (`Ctrl+F5`) y
  confirma tú mismo que el patio, las salas renombradas y el nicho de baños
  se ven y funcionan bien antes de dar esto por cerrado — en particular,
  entra a "Sala de Estudio" y "Depósito de Servicio" y confirma que la
  puerta abre/cierra normal (cambió de id pero no de mecánica).
