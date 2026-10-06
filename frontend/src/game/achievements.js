// Logros: se calculan al final de cada corrida con las estadisticas que manda el
// servidor (MatchSummary) y se guardan en este navegador. `p` es la fila del jugador y
// `run` el resumen completo.

const STORAGE_KEY = 'garavito.achievements.v1';

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Primera sangre', description: 'Elimina tu primer zombi', icon: 'zombie', test: (p) => p.kills >= 1 },
  { id: 'exterminator', name: 'Exterminador', description: 'Elimina 25 zombis en una corrida', icon: 'skull', test: (p) => p.kills >= 25 },
  { id: 'butcher', name: 'Carnicero de la ECI', description: 'Elimina 60 zombis en una corrida', icon: 'sword', test: (p) => p.kills >= 60 },
  { id: 'dutiful', name: 'Cumplidor', description: 'Completa 3 misiones', icon: 'scroll', test: (p) => p.missions >= 3 },
  { id: 'tireless', name: 'Incansable', description: 'Completa 9 misiones en una corrida', icon: 'check', test: (p) => p.missions >= 9 },
  { id: 'angel', name: 'Ángel de bata', description: 'Revive a un compañero', icon: 'cross', test: (p) => p.revives >= 1 },
  { id: 'lifeguard', name: 'Salvavidas', description: 'Revive 3 veces en una corrida', icon: 'heart', test: (p) => p.revives >= 3 },
  { id: 'banker', name: 'Millonario', description: 'Gana 200 Garavitos en una corrida', icon: 'coin', test: (p) => p.garavitosEarned >= 200 },
  { id: 'untouchable', name: 'Intocable', description: 'Llega al Kinder 2 recibiendo 20 de daño o menos', icon: 'shield', test: (p, run) => run.kinderReached >= 2 && p.damageTaken <= 20 },
  { id: 'survivor', name: 'Sobreviviente', description: 'Llega al Kinder 3', icon: 'pumpkin', test: (p, run) => run.kinderReached >= 3 },
  { id: 'never_down', name: 'Nunca caí', description: 'Llega al Kinder 3 sin caer ni una vez', icon: 'star', test: (p, run) => run.kinderReached >= 3 && p.downs === 0 },
  { id: 'legend', name: 'Leyenda del campus', description: 'Supera los 5 Kinders', icon: 'trophy', test: (p, run) => run.victory },
  { id: 'speedrun', name: 'A toda velocidad', description: 'Gana en menos de 15 minutos', icon: 'dash', test: (p, run) => run.victory && run.durationSeconds < 900 },
];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/** { id: fecha ISO } de los logros ya conseguidos en este navegador. */
export function unlockedAchievements() {
  return load();
}

/**
 * Logros que consiguio `role` en la corrida `summary`. Guarda los nuevos y devuelve
 * cada uno con `isNew` si es la primera vez.
 */
export function earnAchievements(summary, role) {
  const player = summary?.players?.find((p) => p.role === role);
  if (!player) return [];
  const unlocked = load();
  const earned = ACHIEVEMENTS.filter((a) => a.test(player, summary)).map((a) => ({ ...a, isNew: !unlocked[a.id] }));
  const fresh = earned.filter((a) => a.isNew);
  if (fresh.length) {
    const now = new Date().toISOString();
    fresh.forEach((a) => {
      unlocked[a.id] = now;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
    } catch {
      // Sin almacenamiento se muestran igual, solo que no quedan guardados.
    }
  }
  return earned;
}
