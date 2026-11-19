import { API_BASE } from '../services/socketService';

// Modos de la sala (GameMode/Difficulty en el servidor).
export const MODES = {
  NORMAL: { label: 'Normal', text: 'La experiencia de siempre.' },
  HARD: { label: 'Difícil', text: 'Zombis con más vida, más rápidos, más mordida y más a la vez.' },
  DAILY: { label: 'Desafío del día', text: 'Una regla distinta cada día, igual para todos. Ranking propio del día.' },
};

export const DAILY_RULES = {
  HORDA_VELOZ: { label: 'Horda veloz', text: 'Los zombis corren un 30 % más.' },
  TANQUES: { label: 'Tanques', text: 'Los zombis aguantan un 60 % más.' },
  MORDIDA_FEROZ: { label: 'Mordida feroz', text: 'Cada mordida quita 3 más.' },
  MAREA: { label: 'Marea', text: 'Hasta un 50 % más de zombis a la vez.' },
  NOCHE_CERRADA: { label: 'Noche cerrada', text: 'Las linternas alumbran menos.' },
};

/** Linterna en "Noche cerrada": un 30 % mas corta. */
export const NIGHT_CONE_FACTOR = 0.7;

/** Regla del desafio de hoy ({ date, rule }) o null si el servidor no responde. */
export async function fetchDailyChallenge() {
  try {
    const response = await fetch(`${API_BASE}/api/daily`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
