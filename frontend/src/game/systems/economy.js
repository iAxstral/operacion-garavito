/**
 * Garavitos — the game's currency. Pure: every function returns new state.
 */

/** Garavitos awarded per zombie killed. */
export const ZOMBIE_BOUNTY = 1;

/** What the axe costs at the puesto de seguridad. */
export const AXE_COST = 10;

export function createEconomy(initial = 0) {
  return { garavitos: initial, totalEarned: initial };
}

export function earn(state, amount) {
  if (amount <= 0) return state;
  return {
    garavitos: state.garavitos + amount,
    totalEarned: state.totalEarned + amount,
  };
}

export function canAfford(state, cost) {
  return state.garavitos >= cost;
}

/**
 * Returns the state unchanged and `ok: false` when the balance is short, so
 * callers branch on the result instead of checking the balance beforehand and
 * risking a negative balance.
 */
export function spend(state, cost) {
  if (!canAfford(state, cost)) return { state, ok: false };
  return {
    state: { ...state, garavitos: state.garavitos - cost },
    ok: true,
  };
}
