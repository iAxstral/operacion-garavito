// Perfil del jugador: suma las estadisticas de cada corrida terminada (el MatchSummary
// del servidor) y guarda las ultimas en este navegador. Cada resumen se cuenta una vez.

const STORAGE_KEY = 'garavito.profile.v1';
const HISTORY_SIZE = 10;

const EMPTY = {
  runs: 0,
  victories: 0,
  bestKinder: 0,
  kills: 0,
  missions: 0,
  revives: 0,
  garavitosEarned: 0,
  damageTaken: 0,
  downs: 0,
  candies: 0,
  secondsPlayed: 0,
  byRole: {},
  bestByBuilding: {},
  history: [],
  counted: [],
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return raw && typeof raw === 'object' ? { ...EMPTY, ...raw } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

function save(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Sin almacenamiento el perfil no se guarda.
  }
}

export function getProfileStats() {
  return load();
}

/** Suma la corrida `summary` al perfil de quien jugo con `role`. False si ya se habia contado. */
export function recordRun(summary, role, now = new Date()) {
  const me = summary?.players?.find((p) => p.role === role);
  if (!me || summary.id == null) return false;
  const stats = load();
  const key = `${summary.building}-${summary.id}-${summary.durationSeconds}`;
  if (stats.counted.includes(key)) return false;
  const kinder = summary.victory ? 5 : summary.kinderReached ?? 0;
  const next = {
    ...stats,
    runs: stats.runs + 1,
    victories: stats.victories + (summary.victory ? 1 : 0),
    bestKinder: Math.max(stats.bestKinder, kinder),
    kills: stats.kills + (me.kills ?? 0),
    missions: stats.missions + (me.missions ?? 0),
    revives: stats.revives + (me.revives ?? 0),
    garavitosEarned: stats.garavitosEarned + (me.garavitosEarned ?? 0),
    damageTaken: stats.damageTaken + (me.damageTaken ?? 0),
    downs: stats.downs + (me.downs ?? 0),
    candies: stats.candies + (me.candies ?? 0),
    secondsPlayed: stats.secondsPlayed + (summary.durationSeconds ?? 0),
    byRole: { ...stats.byRole, [role]: (stats.byRole[role] ?? 0) + 1 },
    bestByBuilding: {
      ...stats.bestByBuilding,
      [summary.building]: Math.max(stats.bestByBuilding[summary.building] ?? 0, kinder),
    },
    history: [{
      at: now.toISOString(),
      building: summary.building,
      role,
      victory: Boolean(summary.victory),
      kinder,
      kills: me.kills ?? 0,
      seconds: summary.durationSeconds ?? 0,
    }, ...stats.history].slice(0, HISTORY_SIZE),
    counted: [...stats.counted, key].slice(-40),
  };
  save(next);
  return true;
}

/** El rol con mas corridas (o null si todavia no hay). */
export function favoriteRole(stats) {
  const entries = Object.entries(stats.byRole ?? {});
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
