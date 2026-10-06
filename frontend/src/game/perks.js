// Mejoras entre Kinders (el servidor las ofrece en el respiro; ver Perk.java).
export const PERKS = {
  REFUERZO: { label: 'Refuerzo', text: 'Cura 40 de vida ahora mismo.', icon: '🩹' },
  RECARGA_RAPIDA: { label: 'Recarga rápida', text: 'Recargas un 35 % más rápido.', icon: '🔄' },
  GOLPE_FUERTE: { label: 'Golpe fuerte', text: '+1 de daño cuerpo a cuerpo.', icon: '👊' },
  PIEL_DURA: { label: 'Piel dura', text: 'Cada mordida te quita 1 menos.', icon: '🛡️' },
  REGENERACION: { label: 'Regeneración', text: 'Recuperas vida sola si no te golpean.', icon: '💚' },
  MUNICION: { label: 'Munición extra', text: '+20 balas de reserva.', icon: '📦' },
  ENERGIA: { label: 'Energía', text: 'Puedes correr un 50 % más.', icon: '⚡' },
  LINTERNA: { label: 'Linterna potente', text: 'Tu linterna alumbra más lejos.', icon: '🔦' },
};

export const ENERGIA_DRAIN_FACTOR = 1 / 1.5;
export const LINTERNA_CONE_FACTOR = 1.35;

export function hasPerk(playerState, perk) {
  return Boolean(playerState?.perks?.includes(perk));
}
