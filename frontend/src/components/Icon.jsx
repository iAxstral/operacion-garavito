/**
 * Iconos dibujados (SVG, 24x24) para reemplazar los emojis en menus y HUD: se ven
 * igual en todos los celulares y toman el color del texto (currentColor).
 */

const PATHS = {
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" />,
  gear: (
    <>
      <path
        d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3.4" fill="#120708" />
    </>
  ),
  book: (
    <path
      d="M3 5.5C5.5 4 8.8 4 12 6c3.2-2 6.5-2 9-.5V19c-2.5-1.5-5.8-1.5-9 .5-3.2-2-6.5-2-9-.5zM12 6v13.5"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
    />
  ),
  trophy: (
    <path
      d="M7 3h10v4.5a5 5 0 0 1-10 0zM7 5H3.5c0 3 1.5 4.5 3.8 4.8M17 5h3.5c0 3-1.5 4.5-3.8 4.8M12 12.5V17M8 21h8l-1-4H9z"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  sound: (
    <path
      d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  mute: (
    <path
      d="M4 9h4l5-4v14l-5-4H4zM16.5 9.5l5 5M21.5 9.5l-5 5"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  music: (
    <path
      d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
    />
  ),
  wind: (
    <path
      d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    />
  ),
  zombie: (
    <>
      <path d="M5 11a7 7 0 0 1 14 0v4l-2 1v4h-3v-2h-4v2H7v-4l-2-1z" fill="currentColor" />
      <circle cx="9" cy="11.5" r="1.8" fill="#120708" />
      <circle cx="15" cy="12" r="1.3" fill="#120708" />
      <path d="M9.5 16h5" stroke="#120708" strokeWidth="1.4" />
      <path d="M8 4.5l2 2.5M13 3.5l-1 3" stroke="#120708" strokeWidth="1.2" />
    </>
  ),
  skull: (
    <>
      <path d="M12 2.5a8 8 0 0 0-8 8c0 3 1.5 4.6 3 5.5V20h10v-4c1.5-.9 3-2.5 3-5.5a8 8 0 0 0-8-8z" fill="currentColor" />
      <circle cx="8.8" cy="11" r="2" fill="#120708" />
      <circle cx="15.2" cy="11" r="2" fill="#120708" />
      <path d="M12 13.5l-1.2 2.5h2.4z" fill="#120708" />
      <path d="M10 17.5v2.5M14 17.5v2.5" stroke="#120708" strokeWidth="1.2" />
    </>
  ),
  heart: (
    <path
      d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.2C21 15 12 20.5 12 20.5z"
      fill="currentColor"
    />
  ),
  cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <circle cx="12" cy="12" r="6.3" fill="none" stroke="#120708" strokeWidth="1.2" opacity="0.6" />
      <path d="M13.8 9.2c-.5-.8-1.3-1.2-2.3-1.2-1.4 0-2.3.8-2.3 1.9 0 2.6 4.9 1.3 4.9 4 0 1.1-1 2-2.5 2-1.1 0-2-.5-2.5-1.3M11.7 6.5v11"
        fill="none" stroke="#120708" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  scroll: (
    <path
      d="M6 3h11a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-1h12v1a3 3 0 0 0 3 3M6 3a2 2 0 0 0-2 2v2h2M9 8h6M9 11.5h6"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  map: (
    <path
      d="M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5zM9 3.5V18M15 6v14.5"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
    />
  ),
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  camera: (
    <path
      d="M3 8h12v9H3zM15 11l6-3.5v10L15 14M6 5.5h4"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="2" fill="currentColor" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="15.5" r="1.6" fill="#120708" />
    </>
  ),
  plug: (
    <path
      d="M9 2v5M15 2v5M6 7h12v3a6 6 0 0 1-12 0zM12 16v6"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  syringe: (
    <path
      d="M18 2l4 4M20 4l-3 3M17 7L7.5 16.5 4.5 19.5M14 4l6 6M15 11l-2-2M12 14l-2-2M17 7l-8.5 8.5-2 .5.5-2L15.5 5.5"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  abacus: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9h18M3 15h18" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="9" r="1.8" fill="currentColor" />
      <circle cx="12" cy="9" r="1.8" fill="currentColor" />
      <circle cx="15" cy="15" r="1.8" fill="currentColor" />
    </>
  ),
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <path d="M5.5 9.5v5M18.5 9.5v5" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  bolt: <path d="M13.5 2L4 14h7l-1.5 8L20 9.5h-7z" fill="currentColor" />,
  brick: (
    <path
      d="M2 5h20v14H2zM2 9.7h20M2 14.3h20M8 5v4.7M16 5v4.7M12 9.7v4.6M5 14.3V19M19 14.3V19M12 14.3V19"
      fill="none" stroke="currentColor" strokeWidth="1.8"
    />
  ),
  shield: (
    <path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z" fill="currentColor" />
  ),
  hand: (
    <path
      d="M8 11V5a1.5 1.5 0 0 1 3 0v5V3.5a1.5 1.5 0 0 1 3 0V10V5a1.5 1.5 0 0 1 3 0v6V8a1.5 1.5 0 0 1 3 0v6a8 8 0 0 1-8 8h-1a7 7 0 0 1-5.5-3L3 14.5a1.5 1.5 0 0 1 2.4-1.8L8 15.5z"
      fill="currentColor"
    />
  ),
  joystick: (
    <>
      <circle cx="12" cy="6" r="3.5" fill="currentColor" />
      <path d="M12 9.5V16M4 16h16v4H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  star: <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill="currentColor" />,
  sword: (
    <path
      d="M20 3l-1 5L9 18l-3-3L16 5zM5 14l5 5M4 20l3-3M7.5 13.5l3 3"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  burst: (
    <path
      d="M12 1.5l2.2 6 5.6-3-2.4 5.9 6.1 1.6-6 2.3 3 5.6-5.9-2.4L12.9 23l-2.3-6-5.6 3 2.4-5.9-6.1-1.6 6-2.3-3-5.6 5.9 2.4z"
      fill="currentColor"
    />
  ),
  gun: (
    <path
      d="M2 7h18l1 3h-6l-1 2h-3l-1.5 7H5l1.5-7H2zM11 12l-.6 2.5"
      fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"
    />
  ),
  rifle: (
    <path
      d="M1.5 10h14l1-1.5h3l.5 1.5h2.5v2.5H16l-1.5 1-1 4h-3l1-4H8l-3 4H1.5l2.5-5h-2.5z"
      fill="currentColor"
    />
  ),
  axe: (
    <path
      d="M14 3c3.5 0 7 3 7 7.5-2.5-1-4.5-.8-6 .7L12.8 9C13.8 7.5 14 5.5 14 3zM13.5 9.5L3 20l1 1L14.5 10.5"
      fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
    />
  ),
  fist: (
    <path
      d="M6 10V7.5a1.5 1.5 0 0 1 3 0V7a1.5 1.5 0 0 1 3 0v.5a1.5 1.5 0 0 1 3 0V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2a2 2 0 0 1 2-2h3"
      fill="currentColor" stroke="#120708" strokeWidth="0.8"
    />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" fill="currentColor" />
      <circle cx="17" cy="9" r="2.6" fill="currentColor" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0zM15 20a5 5 0 0 1 7-4.6V20z" fill="currentColor" />
    </>
  ),
  box: (
    <path
      d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
    />
  ),
  reload: (
    <path
      d="M20 12a8 8 0 1 1-2.3-5.7M20 3.5v4h-4"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    />
  ),
  check: <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />,
  close: <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
  dash: <path d="M4 6l6 6-6 6M12 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  pumpkin: (
    <>
      <path d="M12 6c-5 0-9 3-9 7.3S7 21 12 21s9-3.4 9-7.7S17 6 12 6z" fill="currentColor" />
      <path d="M12 6c1-2 2.5-3 4-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 11.5l2 1.5-2 .5zM16.5 11.5l-2 1.5 2 .5zM7.5 16c2 1.5 7 1.5 9 0l-1.5 1.5-1.5-1-1.5 1-1.5-1-1.5 1z" fill="#120708" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </>
  ),
  radar: (
    <path
      d="M12 20a8 8 0 1 1 8-8M12 16a4 4 0 1 1 4-4M12 12l6-6M10 21h4"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    />
  ),
  pulse: (
    <path d="M2 12h4l2-5 3 10 3-13 2 8h6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
  ),
  pill: (
    <g transform="rotate(-40 12 12)">
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12a3.5 3.5 0 0 1 3.5-3.5H12v7H6.5A3.5 3.5 0 0 1 3 12z" fill="currentColor" />
    </g>
  ),
  chart: (
    <path d="M3 21h18M6 18v-6M11 18V6M16 18v-9M21 18V3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  ),
  receipt: (
    <path
      d="M5 2h14v20l-2.3-1.6L14.3 22 12 20.4 9.7 22l-2.4-1.6L5 22zM8 7h8M8 11h8M8 15h5"
      fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  wrench: (
    <path
      d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3 6.6-6.6-1.3-1.3-6.6 6.6L3 11l2.3-2.3 6.6 6.6 1.3-1.3L6.6 7.4 9 5l2.3 2.3a4 4 0 0 1 3.4-1z"
      fill="currentColor"
    />
  ),
  ruler: (
    <path d="M3 21L21 3M3 21h18L3 3zM7 17h3M7 13h2M7 9h1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  ),
  megaphone: (
    <path
      d="M3 10v4h3l9 5V5L6 10zM18 9a4 4 0 0 1 0 6M6 14l1.5 6h3L9 15"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
    />
  ),
  arrow: <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  question: (
    <path
      d="M8.5 8.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5M12 18.5v.5"
      fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
    />
  ),
};

export default function Icon({ name, title, className = '' }) {
  const shape = PATHS[name] ?? PATHS.question;
  return (
    <svg
      className={`hw-icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {shape}
    </svg>
  );
}

// Los catalogos (misiones, habilidades, tutorial, volumen) guardan un emoji porque
// tambien se usa en textos y en Phaser; en la interfaz se cambia por su dibujo.
const EMOJI_ICONS = {
  '📹': 'camera', '📷': 'camera', '🔐': 'lock', '🔌': 'plug', '💉': 'syringe', '🧮': 'abacus',
  '💵': 'cash', '🧱': 'brick', '⚡': 'bolt', '❔': 'question', '📱': 'phone', '✚': 'cross',
  '💰': 'coin', '🛡️': 'shield', '🛡': 'shield', '🔊': 'sound', '🔈': 'sound', '🔇': 'mute',
  '🎵': 'music', '🌧️': 'wind', '🌧': 'wind', '🧟': 'zombie', '⚔️': 'sword', '⚔': 'sword',
  '🖱️': 'hand', '🖱': 'hand', '🕹️': 'joystick', '🕹': 'joystick', '📋': 'scroll', '✋': 'hand',
  '🔫': 'gun', '★': 'star', '❤': 'heart', '❤️': 'heart', '✊': 'fist', '🪓': 'axe', '🎯': 'rifle',
  '💥': 'burst', '🗺': 'map', '🗺️': 'map', '⚙': 'gear', '⚙️': 'gear', '🏆': 'trophy', '📖': 'book',
  '☠': 'skull', '👥': 'people', '📦': 'box', '✓': 'check', '⟳': 'reload', '»': 'dash', '✕': 'close',
  '👁': 'eye', '📡': 'radar', '💓': 'pulse', '💊': 'pill', '📊': 'chart', '🧾': 'receipt', '🔧': 'wrench', '📐': 'ruler',
};

function iconForEmoji(value) {
  return EMOJI_ICONS[value] ?? null;
}

/** Dibuja el icono de un emoji conocido; si no lo conoce, deja el texto tal cual. */
export function Glyph({ value, title, className }) {
  const name = iconForEmoji(value);
  if (!name) return value ?? null;
  return <Icon name={name} title={title} className={className} />;
}
