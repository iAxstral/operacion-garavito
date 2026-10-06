import { useEffect } from 'react';
import { nameWithRole } from '../game/profile';

// Creditos que suben al ganar (tras el escape). Se cierran con el boton, con Esc o solos.
const ROLL_MS = 38_000;

const SECTIONS = [
  { title: 'Desarrollo', lines: ['Tomás Olaya Díaz', 'Isaac Burgos', 'Javier Romero'] },
  { title: 'Arquitectura de Software (ARSW)', lines: ['Escuela Colombiana de Ingeniería Julio Garavito'] },
  { title: 'Tecnología', lines: ['Spring Boot · STOMP sobre WebSocket', 'React · Phaser', 'PostgreSQL · Redis · Prometheus'] },
  {
    title: 'Sonido (CC0)',
    lines: ['Kenney — Impact Sounds y RPG Audio', 'AntumDeluge — Bat Screeches', 'kurt — Gunshots', 'qubodup — Ghost/monster voice'],
  },
];

export default function Credits({ survivors = [], onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, ROLL_MS);
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="credits-overlay" role="dialog" aria-label="Créditos">
      <div className="credits-roll" style={{ animationDuration: `${ROLL_MS}ms` }}>
        <h1>Operación Garavito</h1>
        <p className="credits-tagline">Lograron salir del edificio. Por ahora.</p>
        {survivors.length > 0 && (
          <section>
            <h2>Sobrevivientes</h2>
            {survivors.map((p) => <p key={p.role}>{nameWithRole(p)}</p>)}
          </section>
        )}
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.lines.map((line) => <p key={line}>{line}</p>)}
          </section>
        ))}
        <p className="credits-end">Gracias por jugar 🎃</p>
      </div>
      <button type="button" className="game-over-btn credits-skip" onClick={onClose}>
        Saltar
      </button>
    </div>
  );
}
