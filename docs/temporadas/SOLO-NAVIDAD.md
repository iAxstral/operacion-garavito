# Spec: el juego queda solo en Navidad

Rama: `feat/solo-navidad` · Estado: implementado (2026-11-06)

## Por qué

Hasta ahora había dos temporadas (Navidad y Halloween) y Navidad se pintaba **encima**
de Halloween: el navegador cargaba los dos temas, se horneaban texturas de las dos y
algunas capas de Halloween (murciélagos y fantasmas de `HauntLayer`) seguían corriendo
en Navidad. El objetivo es que el juego sea **más ligero y más fluido**: un solo tema,
menos CSS, menos texturas y una capa menos actualizándose en cada frame.

## Qué cambia

**Se quita Halloween como temporada:**

- Backend: desaparece `Temporada` (enum), el campo `temporada` de `LobbyRequest`,
  `LobbyState` y `GameSession`. Papá Noel malvado, las travesuras de duendes y renos y el
  resto de lo navideño quedan siempre activos. `TemporadaTest` y el test
  `halloweenHasNoMidBoss` se van.
- Frontend:
  - `temporada.js` y `useTemporada.js` se borran; los datos de la temporada (nombre,
    tagline, moneda "regalos") quedan fijos en `navidad.js`.
  - El menú ya no tiene selector de temporada; la intro siempre es el video de Navidad.
  - Se borran `HauntLayer.js` (murciélagos y fantasmas en el mapa),
    `HalloweenCreatures.jsx` y la parte de Halloween de `HauntedDecor.js` (calabazas,
    telarañas, polvo). De `HauntedDecor.js` se quedan las utilidades que también usa
    Navidad (`seeded`, `canvasTexture`, sombras, fogonazo, casilleros, sangre).
  - Los disfraces de Halloween salen de la tienda y del backend. Quien tenía uno
    equipado vuelve al gorrito de lana; los que tenía comprados dejan de aparecer.
  - La comida siempre se ve como la de Navidad (buñuelos, natilla…).
  - `<html>` queda fijo con `data-temporada="navidad"` (en `index.html`): así las
    reglas de `navidad.css` siguen ganando con la misma especificidad que antes.

**No cambia:** las reglas de juego, roles, Kinders, mapas, ni el estilo base de
`halloween.css` (medidas, fuentes, paneles; ahora `tema.css`), que Navidad reutiliza
recoloreándolo.

También se borraron los archivos que solo usaba Halloween: el video `inicio.mp4` y su
póster (~2,6 MB), `crear-sala-halloween.jpg`, los chillidos de murciélago y el CSS sin
uso (murciélagos, arañas, selector de evento, pantallas ilustradas). La imagen del
campus quedó como `public/mapa/campus-noche.jpg`, `HauntedDecor.js` como
`BaseDecor.js` y `halloween.css` como `tema.css`.

## Verificación

- Backend: `mvn test`, 244 pruebas en verde.
- Frontend: `npm test` (35), `eslint` y `npm run build` limpios. El bundle bajó de
  117,97 kB a 109,97 kB de CSS y de 513,5 kB a 500,2 kB de JS en el chunk principal (el
  del juego, de 1.481,9 kB a 1.474,1 kB).
- E2E (`npx playwright test`): 8 de 8, y una partida de prueba sin errores de consola.

Nota: si el Playwright instalado pide otra versión de Chromium que la de
`~/.cache/ms-playwright`, se puede pasar `launchOptions.executablePath` en un config
local en vez de descargar navegadores.
