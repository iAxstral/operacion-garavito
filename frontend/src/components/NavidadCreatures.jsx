/**
 * Decoracion de Navidad que sigue dando miedo: nieve que cae, una guirnalda de luces
 * que falla y esferas rotas que bajan de su hilo y miran. Es solo decoracion (CSS puro,
 * sin estado): no recibe clics y se apaga con "reducir movimiento" del sistema.
 */

// Cada copo: posicion horizontal, tamano, duracion, retraso y vaiven.
const SNOW = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 37) % 100,
  size: 2 + ((i * 7) % 5),
  dur: 9 + ((i * 13) % 11),
  delay: -((i * 1.7) % 18),
  sway: 12 + ((i * 11) % 30),
}));

// Cada esfera: posicion horizontal, cuanto baja, tamano, color, duracion y retraso.
const ORNAMENTS = [
  { x: 91, drop: 40, size: 36, color: '#0f5c3a', dur: 13, delay: -7 },
  { x: 72, drop: 20, size: 24, color: '#b38a1c', dur: 11, delay: -4 },
  { x: 56, drop: 30, size: 30, color: '#a10f0f', dur: 10, delay: -2 },
  { x: 83, drop: 16, size: 22, color: '#7a0d0d', dur: 14, delay: -10 },
];

// Luces de la guirnalda: color y si es la que esta danada (parpadea en rojo).
const BULB_COLORS = ['#ff3b30', '#ffd34d', '#3ddc84', '#4da3ff'];
const BULBS = Array.from({ length: 22 }, (_, i) => ({
  color: BULB_COLORS[i % BULB_COLORS.length],
  broken: i === 6 || i === 15,
  delay: -((i * 0.37) % 2.4),
}));

function Ornament({ size, color }) {
  return (
    <svg className="xm-ornament-svg" width={size} height={size * 1.2} viewBox="0 0 40 48" aria-hidden="true">
      <rect x="15" y="0" width="10" height="7" rx="1.5" className="xm-ornament-cap" />
      <circle cx="20" cy="27" r="18" fill={color} />
      <path d="M8 18 C14 14 26 14 32 18" className="xm-ornament-shine" />
      {/* Grieta y dos ojos que miran desde adentro. */}
      <path d="M26 11 L22 20 L27 24 L21 33 L24 40" className="xm-ornament-crack" />
      <circle cx="14" cy="27" r="2.2" className="xm-ornament-eye" />
      <circle cx="22" cy="27" r="2.2" className="xm-ornament-eye" />
    </svg>
  );
}

export default function NavidadCreatures({ ornaments = ORNAMENTS.length, snow = SNOW.length, lights = true }) {
  return (
    <div className="xm-creatures" aria-hidden="true">
      {lights && (
        <div className="xm-garland">
          {BULBS.map((bulb, i) => (
            <span
              key={`bulb-${i}`}
              className={`xm-bulb${bulb.broken ? ' xm-bulb--broken' : ''}`}
              style={{ '--color': bulb.color, '--delay': `${bulb.delay}s`, '--i': i }}
            />
          ))}
        </div>
      )}
      {SNOW.slice(0, snow).map((flake, i) => (
        <span
          key={`snow-${i}`}
          className="xm-snow"
          style={{
            '--x': `${flake.x}%`,
            '--size': `${flake.size}px`,
            '--dur': `${flake.dur}s`,
            '--delay': `${flake.delay}s`,
            '--sway': `${flake.sway}px`,
          }}
        />
      ))}
      {ORNAMENTS.slice(0, ornaments).map((ornament, i) => (
        <span
          key={`ornament-${i}`}
          className="xm-ornament"
          style={{
            '--x': `${ornament.x}%`,
            '--drop': `${ornament.drop}vh`,
            '--dur': `${ornament.dur}s`,
            '--delay': `${ornament.delay}s`,
          }}
        >
          <span className="xm-ornament-thread" />
          <Ornament size={ornament.size} color={ornament.color} />
        </span>
      ))}
    </div>
  );
}
