// Ayudas de primera vez: cada una aparece una sola vez (por navegador) cuando el
// jugador se cruza por primera vez con esa mecanica. Se pueden apagar o reiniciar
// desde Configuracion.

const SEEN_KEY = 'garavito.tutorial.v1';

function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

let seen = load();

export function hasSeen(id) {
  return seen.has(id);
}

export function markSeen(id) {
  seen.add(id);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Sin almacenamiento la ayuda puede repetirse en la proxima partida.
  }
}

export function resetTutorial() {
  seen = new Set();
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // nada que borrar
  }
}

/**
 * Las ayudas, en orden de prioridad. `when(ctx)` decide si ya toca mostrarla;
 * `text(ctx)` arma el mensaje segun el dispositivo y el rol.
 */
export const TIPS = [
  {
    id: 'move',
    icon: '🕹️',
    when: (ctx) => ctx.inGame,
    text: (ctx) => (ctx.touch
      ? 'Muévete tocando y arrastrando en la mitad izquierda de la pantalla. ⚔ ataca y » esquiva.'
      : 'Muévete con WASD, apunta con el mouse y ataca con clic o Q. Shift es el dash para esquivar.'),
  },
  {
    id: 'missions',
    icon: '📋',
    when: (ctx) => ctx.inGame && ctx.secondsInGame > 8 && ctx.missions > 0,
    text: (ctx) => `Tienes 3 misiones por Kinder (lista de arriba a la izquierda). ${ctx.touch ? 'El 🗺' : 'La M'} abre el mapa con el camino a la próxima.`,
  },
  {
    id: 'mission_near',
    icon: '✋',
    when: (ctx) => ctx.nearMission,
    text: (ctx) => `${ctx.touch ? 'Toca E' : 'Presiona E'} para empezar la misión. Mientras la haces, los zombis no te dañan.`,
  },
  {
    id: 'zombie_windup',
    icon: '🧟',
    when: (ctx) => ctx.zombieWindingUp,
    text: () => 'Cuando un zombi se pone ROJO va a morder: aléjate o pégale para cortarlo.',
  },
  {
    id: 'money',
    icon: '💰',
    when: (ctx) => ctx.garavitos >= 20,
    text: () => 'Con tus Garavitos compras armas y munición en la máquina del piso 2, y comida en la cafetería del piso 1.',
  },
  {
    id: 'weapon',
    icon: '🔫',
    when: (ctx) => ctx.hasWeapon,
    text: (ctx) => (ctx.touch
      ? 'Cambia de arma con el botón de armas y recarga con ⟳.'
      : 'Cambia de arma con las teclas 1-4 y recarga con R. Las paredes detienen las balas.'),
  },
  {
    id: 'ability',
    icon: '★',
    when: (ctx) => ctx.inGame && ctx.secondsInGame > 25,
    text: (ctx) => `${ctx.touch ? 'El botón ★' : 'La tecla F'} usa tu habilidad: ${ctx.abilityName}. ${ctx.abilityHint}.`,
  },
  {
    id: 'low_health',
    icon: '❤',
    when: (ctx) => ctx.health > 0 && ctx.health <= 40,
    text: (ctx) => `Te queda poca vida: abre el inventario (${ctx.touch ? 'E' : 'E o I'}) y come algo.`,
  },
  {
    id: 'ally_down',
    icon: '✚',
    when: (ctx) => ctx.allyDown,
    text: (ctx) => (ctx.isMedic
      ? 'Un compañero cayó: ve hasta él y mantén E para revivirlo. Solo tú puedes hacerlo.'
      : 'Un compañero cayó: solo Biomédica puede revivirlo. Si no, se levanta al terminar el Kinder.'),
  },
];
