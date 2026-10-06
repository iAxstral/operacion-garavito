// Repeticion de la mejor jugada de la corrida. Se guardan los ultimos segundos del
// estado que manda el servidor (posiciones de jugadores, zombis, jefe y explosiones) y,
// cuando pasa algo destacado, se recorta ese tramo. Al final se ve la mejor.
//
// Lo destacado (y cuanto vale):
//   - varias eliminaciones seguidas de un mismo jugador (10 por zombi, desde 2 en 3 s)
//   - caer el jefe (80)
//   - revivir a alguien con zombis cerca (30 + 5 por zombi a menos de 300 px)
//   - explosiones en cadena (15 por explosion, desde 2 en 1 s)

export const BUFFER_MS = 14_000;
export const BEFORE_MS = 6_000;
export const AFTER_MS = 2_000;
const STREAK_MS = 3_000;
const CHAIN_MS = 1_000;

function frameOf(state, t) {
  return {
    t,
    players: (state.players ?? []).map((p) => ({
      id: p.playerId,
      role: p.role,
      name: p.name ?? null,
      floor: p.floor,
      x: p.x,
      y: p.y,
      down: p.lifeState === 'DOWNED',
      gone: Boolean(p.hidingIn || p.escaped),
    })),
    zombies: (state.zombies ?? []).map((z) => ({ id: z.id, floor: z.floor, x: z.x, y: z.y, kind: z.kind })),
    boss: state.boss ? { floor: state.boss.floor, x: state.boss.x, y: state.boss.y } : null,
    blasts: (state.blasts ?? []).map((b) => ({ id: b.id, floor: b.floor, x: b.x, y: b.y })),
  };
}

export function createRecorder() {
  let frames = [];
  let best = null;
  let pending = null;
  const streaks = new Map();
  const seenBlasts = new Map();
  let lastBoss = null;

  const playerIn = (frame, id) => frame?.players.find((p) => p.id === id);

  const consider = (score, title, focusId, t) => {
    const top = Math.max(best?.score ?? 0, pending?.score ?? 0);
    if (score <= top) return;
    pending = { score, title, focusId, at: t };
  };

  const capture = (t, force = false) => {
    if (!pending || (!force && t < pending.at + AFTER_MS)) return;
    const clip = frames.filter((f) => f.t >= pending.at - BEFORE_MS && f.t <= pending.at + AFTER_MS);
    if (clip.length >= 2) {
      best = { score: pending.score, title: pending.title, focusId: pending.focusId, at: pending.at, frames: clip };
    }
    pending = null;
  };

  return {
    /** Nuevo estado del servidor a la hora `t` (ms). */
    onState(state, t) {
      const frame = frameOf(state, t);
      frames.push(frame);
      frames = frames.filter((f) => f.t >= t - BUFFER_MS);

      // El jefe estaba y ya no: lo derribaron (el ultimo en pegarle no se sabe; se sigue al mas cercano).
      if (lastBoss && !frame.boss && state.wave?.number > 0) {
        const near = frame.players
          .filter((p) => p.floor === lastBoss.floor)
          .sort((a, b) => Math.hypot(a.x - lastBoss.x, a.y - lastBoss.y) - Math.hypot(b.x - lastBoss.x, b.y - lastBoss.y))[0];
        consider(80, '¡Cayó el Ingeniero de Sistemas!', near?.id ?? null, t);
      }
      lastBoss = frame.boss;

      frame.blasts.forEach((b) => {
        if (!seenBlasts.has(b.id)) seenBlasts.set(b.id, t);
      });
      const recent = [...seenBlasts.values()].filter((at) => at >= t - CHAIN_MS).length;
      if (recent >= 2) {
        const closest = frame.players[0];
        consider(15 * recent, `Explosión en cadena (×${recent})`, closest?.id ?? null, t);
      }
      [...seenBlasts].forEach(([id, at]) => {
        if (at < t - BUFFER_MS) seenBlasts.delete(id);
      });

      capture(t);
    },

    /** Evento del servidor a la hora `t` (ms). `nameOf(id)` da el nombre a mostrar. */
    onEvent(event, t, nameOf = (id) => id) {
      if (event.type === 'ATTACK_KILL') {
        const kills = Number(event.itemId) || 0;
        const list = (streaks.get(event.playerId) ?? []).filter((at) => at.t >= t - STREAK_MS);
        list.push({ t, kills });
        streaks.set(event.playerId, list);
        const total = list.reduce((sum, k) => sum + k.kills, 0);
        if (total >= 2) {
          const label = total === 2 ? 'Doble' : total === 3 ? 'Triple' : total === 4 ? 'Cuádruple' : `×${total}`;
          consider(10 * total, `${label} eliminación de ${nameOf(event.playerId)}`, event.playerId, t);
        }
      } else if (event.type === 'REVIVED') {
        const frame = frames[frames.length - 1];
        const revived = playerIn(frame, event.playerId);
        const around = revived
          ? frame.zombies.filter((z) => z.floor === revived.floor && Math.hypot(z.x - revived.x, z.y - revived.y) < 300).length
          : 0;
        consider(30 + 5 * around, `${nameOf(event.itemId)} revivió a ${nameOf(event.playerId)}${around ? ` con ${around} zombis encima` : ''}`,
          event.itemId, t);
      }
    },

    /** Recorta ya la jugada pendiente con lo que haya (la corrida termino antes del "despues"). */
    flush() {
      capture(Infinity, true);
    },

    /** La mejor jugada hasta ahora (o null). */
    best() {
      return best;
    },

    reset() {
      frames = [];
      best = null;
      pending = null;
      streaks.clear();
      seenBlasts.clear();
      lastBoss = null;
    },
  };
}

/** Posicion interpolada de una entidad entre dos cuadros (o la del primero si desaparece). */
export function lerpEntity(a, b, alpha) {
  if (!b || a.floor !== b.floor) return a;
  return { ...a, x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
}
