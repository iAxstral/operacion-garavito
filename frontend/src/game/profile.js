import { roleInfo } from './roleCatalog';

// Apodo del jugador: se guarda en este navegador y viaja al servidor al unirse a una
// sala. Las mismas reglas que Player.setName en el servidor (16 caracteres, sin
// caracteres de control: se vuelven espacio).

const STORAGE_KEY = 'garavito.nickname';
export const MAX_NICKNAME = 16;

export function cleanNickname(raw) {
  return [...String(raw ?? '')]
    .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, MAX_NICKNAME);
}

export function getNickname() {
  try {
    return cleanNickname(localStorage.getItem(STORAGE_KEY)).trim();
  } catch {
    return '';
  }
}

export function setNickname(value) {
  try {
    localStorage.setItem(STORAGE_KEY, cleanNickname(value).trim());
  } catch {
    // Sin almacenamiento se juega sin apodo guardado.
  }
}

/** Como se le llama a un jugador en pantalla: su apodo o, si no tiene, su rol. */
export function displayName(player) {
  if (!player) return '';
  return player.name || roleInfo(player.role ?? player.playerId).name;
}

/** "Apodo (Rol)" o solo el rol: para listas donde tambien importa el rol. */
export function nameWithRole(player) {
  if (!player) return '';
  const role = roleInfo(player.role ?? player.playerId).name;
  return player.name ? `${player.name} (${role})` : role;
}
