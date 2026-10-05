import { useEffect, useState } from 'react';
import { isTouchDevice } from '../game/gameSync';
import { ROLE_CATALOG } from '../game/roleCatalog';
import MissionSummary from './MissionSummary';
import { abilityFor } from '../game/abilityCatalog';
import { playSfx } from '../game/sfx';
import { Glyph } from './Icon';

const TABS = [
  { id: 'goal', label: 'Objetivo' },
  { id: 'controls', label: 'Controles' },
  { id: 'roles', label: 'Roles' },
  { id: 'enemies', label: 'Zombis y armas' },
];

const KEYBOARD = [
  ['WASD / flechas', 'Moverse'],
  ['Mouse', 'Apuntar'],
  ['Q / clic', 'Atacar o disparar'],
  ['1 - 4', 'Cambiar de arma'],
  ['R', 'Recargar'],
  ['C', 'Ataque cargado (en área)'],
  ['Shift', 'Dash (esquivar)'],
  ['F', 'Habilidad de tu rol'],
  ['E', 'Interactuar: misiones, tienda, puertas, escaleras, inventario'],
  ['M / Tab', 'Mapa y equipo'],
  ['Z / X / V / G / B', 'Avisar al equipo: zombis, ayuda, revívanme, vamos, munición'],
  ['Esc', 'Configuración'],
];

const TOUCH = [
  ['Joystick', 'Toca y arrastra en la mitad izquierda'],
  ['⚔', 'Atacar o disparar (apunta solo al zombi más cercano)'],
  ['💥', 'Ataque cargado'],
  ['»', 'Dash'],
  ['★', 'Habilidad de tu rol'],
  ['E', 'Interactuar (mantén para revivir)'],
  ['🔫 / ⟳', 'Cambiar de arma / recargar'],
  ['🗺 / ⚙', 'Mapa / configuración'],
  ['📣', 'Avisar al equipo (se escucha con la voz de tu rol)'],
];

export default function HowToPlay({ onClose }) {
  const [tab, setTab] = useState('goal');

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div className="settings-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="settings-panel howto-panel" role="dialog" aria-modal="true" aria-labelledby="howto-title">
        <header className="settings-header">
          <h2 id="howto-title">Cómo jugar</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        <div className="howto-tabs" role="tablist">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`howto-tab${tab === entry.id ? ' howto-tab--active' : ''}`}
              onClick={() => {
                setTab(entry.id);
                playSfx('click');
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === 'goal' && (
          <section className="howto-section">
            <p>El campus se llenó de zombis. Hasta 4 jugadores, cada uno con un rol distinto, tienen que sobrevivir <strong>5 Kinders</strong> en el edificio.</p>
            <ol>
              <li>Cada Kinder se pasa matando la <strong>cuota de zombis</strong> y completando <strong>3 misiones por jugador</strong> (el último Kinder además pide derrotar al Ingeniero de Sistemas).</li>
              <li>Las misiones pagan <strong>Garavitos</strong>: úsenlos bien en armas, munición y comida.</li>
              <li>Si caes, miras a tus compañeros hasta que <strong>Biomédica</strong> te reviva o termine el Kinder.</li>
              <li>Si cae todo el equipo, se vuelve al Kinder 1.</li>
            </ol>
            <p className="howto-tip">Cuando un zombi se pone <strong>rojo</strong> va a morder: aléjate o pégale para cortarlo.</p>
          </section>
        )}

        {tab === 'controls' && (
          <section className="howto-section">
            <table className="howto-keys">
              <tbody>
                {(isTouchDevice() ? TOUCH : KEYBOARD).map(([key, action]) => (
                  <tr key={key}>
                    <th scope="row">
                      {key.split(' / ').map((part, i) => (
                        <span key={part}>{i > 0 && ' / '}<kbd><Glyph value={part} /></kbd></span>
                      ))}
                    </th>
                    <td>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'roles' && (
          <section className="howto-section howto-roles">
            {ROLE_CATALOG.map((entry) => {
              const ability = abilityFor(entry.role);
              return (
                <article key={entry.role} className="howto-role">
                  <img src={entry.portrait} alt="" />
                  <div>
                    <h3>{entry.name}</h3>
                    <p><strong><Glyph value={ability.icon} /> {ability.name}:</strong> {ability.hint}.</p>
                    <p className="howto-muted">Misiones: <MissionSummary role={entry.role} /></p>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {tab === 'enemies' && (
          <section className="howto-section">
            <h3>Zombis</h3>
            <ul>
              <li><strong>Común</strong>: se prepara antes de morder (se pone rojo).</li>
              <li><strong>Resistente</strong> (rojizo): aguanta más golpes y muerde más fuerte.</li>
              <li><strong>Corredor</strong> (gris azulado, desde el Kinder 2): muy rápido pero cae de un golpe.</li>
              <li><strong>Escupidor</strong> (verde, desde el Kinder 3): escupe ácido de lejos; se pone verde antes: muévete.</li>
              <li><strong>Ingeniero de Sistemas</strong>: el jefe del Kinder 5.</li>
            </ul>
            <h3>Armas (máquina del piso 2)</h3>
            <ul>
              <li><strong>Hacha</strong>: cuerpo a cuerpo, mata a un común de un golpe.</li>
              <li><strong>Pistola</strong>: 8 balas por cargador.</li>
              <li><strong>Rifle</strong>: 5 balas, mucho daño y atraviesa hasta 3 zombis.</li>
              <li><strong>Munición</strong>: +15 balas de reserva. Las paredes detienen las balas.</li>
            </ul>
          </section>
        )}

        <footer className="settings-footer">
          <span className="howto-muted">Los avisos de ayuda aparecen durante tu primera partida.</span>
          <button type="button" className="main-menu-play-btn settings-done" onClick={onClose}>Entendido</button>
        </footer>
      </div>
    </div>
  );
}
