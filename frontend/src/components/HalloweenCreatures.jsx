/**
 * Murcielagos que cruzan la pantalla y aranas que bajan de su hilo. Es solo
 * decoracion (CSS puro, sin estado): no recibe clics y se apaga con
 * "reducir movimiento" del sistema.
 */

// Cada murcielago: altura de vuelo, tamano, duracion, retraso y sentido.
const BATS = [
  { top: 14, size: 46, dur: 11, delay: 0, dir: 1 },
  { top: 26, size: 30, dur: 14, delay: -5, dir: -1 },
  { top: 9, size: 24, dur: 17, delay: -9, dir: 1 },
  { top: 38, size: 36, dur: 13, delay: -2.5, dir: -1 },
  { top: 20, size: 20, dur: 19, delay: -12, dir: 1 },
  { top: 48, size: 28, dur: 16, delay: -7, dir: 1 },
];

// Cada arana: posicion horizontal, cuanto baja, tamano, duracion y retraso.
const SPIDERS = [
  { x: 6, drop: 34, size: 30, dur: 9, delay: -1 },
  { x: 93, drop: 46, size: 36, dur: 12, delay: -6 },
  { x: 71, drop: 22, size: 22, dur: 10, delay: -3.5 },
  { x: 27, drop: 18, size: 20, dur: 13, delay: -9 },
];

function Bat({ size }) {
  return (
    <svg className="hw-bat-svg" width={size} height={size / 2} viewBox="0 0 64 32" aria-hidden="true">
      <path
        className="hw-bat-wing hw-bat-wing--left"
        d="M30 14 C24 5 14 3 1 8 C7 10 8 14 6 19 C10 15 14 17 16 21 C18 16 24 16 30 19 Z"
      />
      <path
        className="hw-bat-wing hw-bat-wing--right"
        d="M34 14 C40 5 50 3 63 8 C57 10 56 14 58 19 C54 15 50 17 48 21 C46 16 40 16 34 19 Z"
      />
      <path d="M29 9 L30 5 L31.5 9 L32.5 9 L34 5 L35 9 C36 11 36 21 32 25 C28 21 28 11 29 9 Z" />
      <circle className="hw-bat-eye" cx="30.6" cy="11" r="0.9" />
      <circle className="hw-bat-eye" cx="33.4" cy="11" r="0.9" />
    </svg>
  );
}

function Spider({ size }) {
  return (
    <svg className="hw-spider-svg" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <g className="hw-spider-legs" fill="none" strokeWidth="1.8" strokeLinecap="round">
        <path d="M16 18 C10 12 6 12 3 16" />
        <path d="M16 21 C9 19 5 21 2 25" />
        <path d="M17 24 C11 26 8 30 7 35" />
        <path d="M18 26 C15 31 14 34 14 38" />
        <path d="M24 18 C30 12 34 12 37 16" />
        <path d="M24 21 C31 19 35 21 38 25" />
        <path d="M23 24 C29 26 32 30 33 35" />
        <path d="M22 26 C25 31 26 34 26 38" />
      </g>
      <ellipse cx="20" cy="26" rx="6.5" ry="7.5" />
      <circle cx="20" cy="17" r="4.2" />
      <circle className="hw-spider-eye" cx="18.4" cy="16.4" r="0.95" />
      <circle className="hw-spider-eye" cx="21.6" cy="16.4" r="0.95" />
      <path className="hw-spider-mark" d="M20 22 L18 26 L20 30 L22 26 Z" />
    </svg>
  );
}

export default function HalloweenCreatures({ bats = BATS.length, spiders = SPIDERS.length }) {
  return (
    <div className="hw-creatures" aria-hidden="true">
      {BATS.slice(0, bats).map((bat, i) => (
        <span
          key={`bat-${i}`}
          className={`hw-bat${bat.dir < 0 ? ' hw-bat--reverse' : ''}`}
          style={{ '--top': `${bat.top}%`, '--dur': `${bat.dur}s`, '--delay': `${bat.delay}s` }}
        >
          <span className="hw-bat-bob" style={{ '--bob': `${0.5 + (i % 3) * 0.17}s` }}>
            <Bat size={bat.size} />
          </span>
        </span>
      ))}
      {SPIDERS.slice(0, spiders).map((spider, i) => (
        <span
          key={`spider-${i}`}
          className="hw-spider"
          style={{
            '--x': `${spider.x}%`,
            '--drop': `${spider.drop}vh`,
            '--dur': `${spider.dur}s`,
            '--delay': `${spider.delay}s`,
          }}
        >
          <span className="hw-spider-thread" />
          <Spider size={spider.size} />
        </span>
      ))}
    </div>
  );
}
