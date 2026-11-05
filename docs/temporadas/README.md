# Temporadas: Navidad sangrienta y Noche de Halloween

El juego tiene **temporadas** (eventos): la misma partida con otra ambientación, como
las listas de juego por evento de los shooters. La temporada actual es **Navidad
sangrienta**: sigue dando miedo, pero con nieve, luces que fallan y regalos que nadie
debería abrir. **Halloween**, la versión original, queda como evento para quien lo
quiera jugar.

Las reglas no cambian: los roles, las misiones, los Kinders, los zombis y el jefe son
los mismos. Solo cambia lo que se ve y se oye.

## Cómo se elige

En el menú principal, debajo del título, están los dos eventos. La elección se guarda
en el navegador (`localStorage`, clave `garavito.temporada.v1`). Si nunca se eligió
nada, la temporada es Navidad.

![Menú en Navidad](img/01-menu-navidad.jpg)

![Menú en Halloween](img/02-menu-halloween.jpg)

**Dentro de una sala manda la temporada de la sala.** La elige quien la crea y la ven
igual todos los que entran, aunque cada uno tenga otra preferida. Al salir de la sala,
cada jugador vuelve a la suya. Así nadie juega una partida de Navidad mientras su
compañero ve calabazas.

## Cómo funciona

```
menú (preferida, localStorage) ──crear sala──▶ /app/game/{código}/lobby { …, temporada }
                                                     │
                                       GameSession.temporada (NAVIDAD | HALLOWEEN)
                                                     │
                           LobbyState.temporada en cada estado del juego
                                                     │
            gameSync ─▶ setTemporadaDeSala() ─▶ <html data-temporada="navidad|halloween">
                                                     │
                     CSS (navidad.css) · React (useTemporada) · Phaser (getTemporada)
```

| Pieza | Archivo | Qué hace |
|---|---|---|
| Temporada de la sala | `backend/.../game/Temporada.java`, `GameSession`, `LobbyState` | Se fija al crear la sala (por defecto `NAVIDAD`) y viaja en el estado del lobby. |
| Preferida y activa | `frontend/src/game/temporada.js` | Catálogo de temporadas, preferencia guardada y la de la sala cuando hay una. |
| React | `frontend/src/components/useTemporada.js` | Hook que redibuja el componente si cambia la temporada. |
| Estilos | `frontend/src/navidad.css` | Reemplaza la paleta de Halloween (`--hw-*`) y los fondos cuando `data-temporada="navidad"`. |

## Qué cambia en Navidad

### Menús

- **Fondo:** la vista nocturna del campus en vez del video de Halloween, con filtro de
  invierno, nieve que cae y una guirnalda de luces que falla.
- **Criaturas:** donde Halloween tiene murciélagos y arañas, Navidad tiene copos de
  nieve y esferas rotas que bajan de su hilo con ojos adentro
  (`NavidadCreatures.jsx`).
- **Pantallas propias de Navidad**, hechas con código (sin las ilustraciones de
  Halloween, que siguen intactas en su evento):
  - **Selección de edificio:** un **calendario de adviento maldito**. Cada edificio es
    una puerta del 19 al 24 de diciembre; al pasar por encima se entreabre y adentro
    asoman ojos rojos.
  - **Sala de juego:** dos **cartas a Papá Noel** con sello de cera, una para crear la
    sala y otra para unirse con el código, y un regalo que tiembla.
  - **Elegir rol:** cada rol es una **caja de regalo** con lazo dorado que se destapa
    al pasar por encima.
  - **Sala de espera:** cada puesto ocupado se envuelve como regalo. El código brilla
    entre azul helado y rojo.
  - **Resultados:** panel frío con nieve acumulada encima.

![Selección de edificio](img/03-edificios-navidad.jpg)

![Selección de edificio en celular](img/12-edificios-celular.jpg)

![Sala de juego](img/04-sala-navidad.jpg)

![Elegir rol](img/05-rol-navidad.jpg)

![Sala de espera](img/11-espera-navidad.jpg)

### Intro

La primera vez en la sesión, Navidad abre con su propio video de intro, **"Navidad
maldita"** (~38 s, con sonido): el duelo por la Decanatura y la presentación del juego.
Se puede saltar o activar el sonido; al terminar, el menú queda sobre el campus de
noche. Halloween conserva su video.

El video está en `frontend/public/video/intro-navidad.mp4` (720p, ~5 MB, recomprimido
para la web) y su primer cuadro en `intro-navidad-poster.jpg`. Lo muestra
`MainMenu.jsx`.

![Intro de Navidad](img/10-intro-navidad.jpg)

La música de Navidad, en el menú y en la partida, es **"We Wish You a
Merry Christmas"** (villancico tradicional en inglés, de dominio público) en La menor
armónica: la caja de música rota, un coro grave durante el Kinder y un eco desafinado
cuando hay peligro (`game/villancico.js`).

### Partida

- **Decorado** (`game/NavidadDecor.js`): arbolitos de Navidad marchitos con luces que
  titilan y fallan, y regalos abiertos a la fuerza, en los mismos lugares donde
  Halloween pone calabazas. Hay carámbanos de hielo donde iban las telarañas. Las
  posiciones salen de una semilla por edificio y piso, así que todos ven lo mismo.
- **Nieve** que cae alrededor del jugador, en lugar de las motas de polvo.
- **Luz fría:** la oscuridad es azul helada (`Lighting.js`) y un velo sobre el mapa
  enfría el piso y las luces cálidas sin apagar el rojo de la sangre.
- **Zombis navideños:** gorro de Papá Noel rasgado (sale volando cuando mueren) y un
  **suéter navideño feo** distinto por tipo, con una tira de luces que titila al
  caminar. El explosivo va envuelto como regalo (`zombieArt.js`).
- **Personajes con gorrito:** quien no lleva nada de la tienda se ve con un gorrito de
  lana a rayas con pompón.

![Partida en Navidad](img/06-partida-navidad.jpg)

![Zombis con gorro](img/08-zombi-gorro.png)

#### Papá Noel malvado (Kinder 3)

En Navidad, al empezar el **Kinder 3** aparece **Papá Noel malvado**: un jefe más débil
que el Ingeniero de Sistemas (70% de vida, algo más lento, muerde menos) que suelta su
"¡JO, JO, JO!" mientras persigue. Ese Kinder se pasa con la cuota, las misiones **y**
derribándolo. En Halloween el Kinder 3 no tiene jefe.

| Pieza | Archivo |
|---|---|
| Qué jefe es y cómo se ajusta | `BossKind.java` (viaja en `BossView.kind`) |
| Kinder del jefe intermedio | `WaveDirector.setMidBossKinder`, `GameSession.PAPA_NOEL_KINDER` |
| Dibujo | `public/bosses/boss_santa.png`, generado con `tools/sprites/boss_santa.py` desde las poses del jefe (traje rojo, cinturón, gorro y barba) |

#### Duendes y renos

Durante un Kinder de Navidad, cada 9 a 16 s sale **de la nada** (en una nube de nieve y
con un **!** encima) un **duende** cerca de un jugador; desde el Kinder 2 puede ser un
**reno zombi**. Se queda un instante y tira hacia donde estaba el jugador: si se movió,
la esquiva.

- **Bola de nieve del duende:** deja la pantalla en blanco y se aclara en ~1 s. No
  quita vida.
- **Barro con carbón del reno:** salpica la pantalla con manchas que escurren y tardan
  unos segundos en caerse, y quita 3 de vida.

Lo decide el servidor (`Travesuras.java`): dónde aparece cada bicho, el recorrido de
la bola y a quién le pega. Viaja en el estado como `travesuras` y el cliente lo dibuja
(`TravesurasLayer.js`, pixel art en `travesurasArt.js`); el efecto en la pantalla del
golpeado está en `screenFx.js`.

![Papá Noel malvado, un duende y un reno](img/16-papa-noel-duende-reno.jpg)

![Bola de nieve en la cara](img/18-bola-de-nieve.jpg)

![Barro del reno](img/17-barro-reno.jpg)

#### Comida de diciembre

En Navidad la comida que cura es la de diciembre en Colombia. Cura lo mismo y cuesta lo
mismo (el servidor usa los mismos ids); solo cambia cómo se ve y se llama
(`game/comidas.js`):

| Halloween | Navidad |
|---|---|
| Empanada (+20) | Natilla |
| Arepa (+15) | Buñuelo |
| Energizante (+10) | Chocolate caliente |
| Gaseosa (+5) | Galleta de jengibre |
| Comida del mapa (cuadrito verde) | Buñuelos, natilla, chocolate con queso y galletas (flotando) |

![Comida de Navidad](img/19-comida-navidad.png)

Pixel art generado con `tools/sprites/comidas_navidad.py`.

Halloween dentro de la partida sigue exactamente igual que antes:

![Partida en Halloween](img/07-partida-halloween.jpg)

### Sonido

En la música generada (`game/music.js`), Navidad toca "We Wish You a Merry
Christmas" en tono de terror (ver arriba). Durante el Kinder suman **cascabeles de
trineo** al pulso.

### Tienda de objetos

Desde el menú (botón dorado **Tienda de objetos**, justo debajo de Jugar) se abre una
tienda que **cambia cada medianoche** y es la misma para todos ese día:

- **Destacados:** dos objetos épicos o legendarios del evento.
- **Ofertas del día:** cuatro más del evento (uno con **30% de descuento**) y uno de
  otro evento que **vuelve** por un día.
- Cartas del color de su **rareza** (común, raro, épico, legendario), etiquetas de
  **¡Nuevo!**, cuenta regresiva hasta la próxima rotación y un **casillero** con lo
  comprado para ponérselo o quitárselo.

Se paga con lo que suelta la horda: **regalos** en Navidad y **dulces** en Halloween (es
la misma bolsa). Hay 11 objetos de Navidad: gorro de Papá Noel, gorro de duende,
bufanda de la abuela, cornamenta, corona de acebo, guirnalda de luces, esfera rota,
muñeco de nieve, máscara de Krampus, gorro de cascanueces y estrella de la punta. Lo que
uno se pone lo ven todos en la partida.

La rotación sale de mezclar el catálogo con la fecha como semilla (`tiendaDelDia` en
`game/costumes.js`); la pantalla está en `components/ItemShop.jsx`.

![Tienda de objetos](img/13-tienda-objetos.jpg)

![Detalle de un objeto](img/14-tienda-detalle.jpg)

![Tienda en celular](img/15-tienda-celular.jpg)

## Pruebas

| Prueba | Qué verifica |
|---|---|
| `TemporadaTest` (backend) | Navidad por defecto, la sala guarda la temporada con que se creó y entrar a una sala no se la cambia. |
| `CandyCostumeTest` (backend) | Se aceptan los objetos de Navidad. |
| `GameSessionZombieTest` (backend) | Papá Noel aparece en el Kinder 3 de Navidad y hay que derribarlo para pasarlo; en Halloween no. |
| `TravesurasTest` (backend) | El duende aparece con línea de visión, su bola le pega a quien no se mueve y se esquiva moviéndose; el barro quita vida; solo hay travesuras en un Kinder activo. |
| `comidas.test.js` | La comida de Navidad cura y cuesta lo mismo, y toda la del mapa tiene su dibujo. |
| `temporada.test.js` | Preferencia guardada, prioridad de la sala sobre la preferida y aviso de cambios. |
| `costumes.test.js` | La tienda es la misma todo el día y rota entre días, con 2 destacados, 4 diarios (uno en oferta) y uno que vuelve; se compra al precio de oferta. |
| `e2e/temporada.spec.js` | Elegir Halloween en el menú y que un invitado con Navidad vea la temporada de la sala (y vuelva a la suya al salir). |
| `e2e/partida.spec.js` | Navidad abre con su video de intro; Halloween conserva el suyo. |

## Agregar otra temporada

1. Un valor nuevo en `Temporada.java` y su entrada en `TEMPORADAS` (`temporada.js`):
   nombre, textos y moneda.
2. Un CSS con `:root[data-temporada='nueva']` (como `navidad.css`).
3. En `MainScene`, `Lighting`, `ZombieLayer` y `music.js`, la rama de la nueva
   temporada, donde haga falta.
