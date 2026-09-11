/**
 * Minimal synchronous event bus.
 *
 * The Phaser layer and the pure rule modules only talk through this, so the
 * rules never import Phaser and can move to the backend later untouched
 * (see GAMEPLAY.md). Phaser's own EventEmitter would have worked, but using it
 * would tie `systems/` to the engine — exactly what this split avoids.
 */
export function createEventBus() {
  const listeners = new Map();

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => this.off(event, handler);
    },

    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },

    emit(event, payload) {
      // Copied before iterating: a handler may unsubscribe itself (missions do,
      // when they complete) and mutating a Set mid-iteration skips handlers.
      const handlers = listeners.get(event);
      if (!handlers) return;
      [...handlers].forEach((handler) => handler(payload));
    },

    clear() {
      listeners.clear();
    },
  };
}
