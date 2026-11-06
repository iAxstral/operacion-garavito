# Spec: rendimiento del cliente, indicador de FPS/ping y logros de Nochebuena

Rama: `feat/solo-navidad` · Estado: implementado (2026-11-06)

Cuatro mejoras independientes; cada una va en sus propios commits y con sus pruebas.

## 1. Luces con sellos pre-renderizados (rendimiento)

**Problema.** `Lighting.update` corre en cada frame y, por cada bombillo, jugador,
cono de linterna y fogonazo, crea un `createRadialGradient` nuevo y rellena un arco.
Con 20-30 luces por piso son ~60 gradientes por frame que el navegador compila y
descarta, más basura para el recolector.

**Solución.** Hornear una sola vez dos "sellos" en canvas fuera de pantalla:

- `halo`: el degradado radial de `punch` (paradas 1 → 0,6 → 0) en 256×256.
- `cono`: el sector de la linterna con su degradado (paradas 1 → 0,75 → 0), uno por
  cada ancho de cono (pasada ancha y angosta).

`punch` y `punchCone` pasan a ser `drawImage` del sello escalado, con
`globalAlpha = fuerza`. Con `destination-out` el alfa del origen se multiplica por
`globalAlpha`, así que el resultado es el mismo que el degradado con las paradas
multiplicadas por la fuerza. El cono se dibuja rotando el contexto (`setTransform`).
Las luces fuera de la vista se descartan antes de tocar sus sprites.

**Pruebas.** La matemática de recorte (`lightMath.js`: si un círculo toca la vista y
cómo pasar de mundo a la textura) queda en funciones puras con pruebas en Node.

## 2. Calidad automática (rendimiento)

**Problema.** El modo de rendimiento existe, pero hay que saber que existe, y solo se
aplica al cambiar de piso.

**Solución.**

- `perfMonitor.js` (puro, con pruebas): promedio móvil de los FPS de los últimos
  ~5 s con histéresis. Pide bajar la calidad si el promedio queda bajo 40 FPS por
  5 s seguidos, y no vuelve a decidir durante 20 s.
- Ajuste nuevo `autoPerf` ("Calidad automática", activado por defecto). Si está
  prendido y el monitor lo pide, se activa `lowPerf` y el HUD avisa una vez.
- El modo de rendimiento se aplica **en vivo**: `Lighting.setLowPerf` cambia la
  resolución de la capa de oscuridad y quita la neblina; la nieve y la sangre se
  ajustan sin cambiar de piso.

## 3. Indicador de FPS y ping

- Backend: `GET /api/ping` responde `{ "serverTime": <ms> }` sin tocar la base de
  datos (prueba con MockMvc).
- `latency.js` (puro, con pruebas): mide el tiempo de ida y vuelta y lo suaviza
  (media móvil exponencial), ignorando las respuestas que fallan.
- Ajuste nuevo `showStats` ("Mostrar FPS y ping"). En la partida, un recuadro chico
  en una esquina con los FPS (de `game.loop.actualFps`) y el ping, en verde, amarillo
  o rojo según lo bueno que sea. Se mide cada 3 s solo mientras está visible.

## 4. Estadísticas de travesuras y logros de Nochebuena

- Backend: cada bola de nieve o de barro recuerda a quién iba dirigida. Si le pega,
  suma `bolasRecibidas` a ese jugador; si se pierde (pared, tiempo o se movió), suma
  `bolasEsquivadas`. Las dos van en `MatchSummary.PlayerSummary` (no se guardan en el
  historial, como los regalos).
- Frontend: la pantalla de resultados muestra las bolas recibidas y esquivadas, y hay
  cinco logros nuevos:
  - **Cazador de Papá Noel**: pasar el Kinder 3 (solo se pasa derribándolo).
  - **Ágil como un reno**: esquivar 5 bolas en una corrida.
  - **Muñeco de nieve**: recibir 5 bolas en una corrida.
  - **Nochebuena impecable**: llegar al Kinder 3 sin recibir ninguna bola.
  - **Regalo para todos**: juntar 10 regalos en una corrida.
- El logro "Sobreviviente" deja el ícono de calabaza y usa el de regalo.

## Resultados

Medido en el Chromium de Playwright sin GPU (canvas por software), edificio F, piso 1,
18 bombillos en el piso:

| Medida | Antes | Después |
|---|---|---|
| Dibujar halos y cono de un cuadro (forzando el dibujado) | 0,91 ms | 0,88 ms |
| Gradientes creados por cuadro | ~20 (uno por luz y pasada) | 0 |
| Bombillos con sus 3 sprites dibujados | 18 | 7 (los que están en la vista) |
| Diferencia de alfa de la oscuridad, píxel a píxel | – | 0,17 / 255 en promedio |

Lo que más se gana no es el tiempo de dibujado del canvas, que en este equipo casi no
cambia, sino **no generar basura** cada cuadro (menos pausas del recolector) y **no
dibujar los sprites** de las luces que no se ven. En celulares con GPU, donde el canvas
2D va acelerado, los sellos deberían ayudar más; queda por medir en un equipo real.

La calidad automática no salta en CI con la configuración por defecto (el juego anda
alrededor de 43 FPS y el umbral es 40); las pruebas e2e que miden algo fino la apagan.

Pruebas nuevas: `lightMath.test.js`, `perfMonitor.test.js`, `latency.test.js`,
`liveStats.test.js`, ajustes en `settings.test.js` y `achievements.test.js`,
`PingControllerTest`, travesuras en `TravesurasTest` y `MatchSummaryTest`, y
`e2e/rendimiento.spec.js`.

## Fuera de alcance

- Pasar la capa de oscuridad a un shader de WebGL: mejoraría más, pero cambia cómo se
  ve y necesita probarse en celulares.
- Guardar las estadísticas de travesuras en el historial (requiere migración).
