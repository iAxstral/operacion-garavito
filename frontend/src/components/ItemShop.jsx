import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COSTUMES,
  RAREZAS,
  buyCostume,
  equipCostume,
  getBag,
  msHastaRenovar,
  tiendaDelDia,
} from '../game/costumes';
import { COSTUME_SIZE, drawCostume } from '../game/costumeArt';
import { playSfx } from '../game/sfx';
import Icon from './Icon';
import useTemporada from './useTemporada';
import './itemShop.css';

function Preview({ id, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) drawCostume(ref.current.getContext('2d'), id);
  }, [id]);
  return <canvas ref={ref} width={COSTUME_SIZE} height={COSTUME_SIZE} className={className} aria-hidden="true" />;
}

function reloj(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** El reloj de la tienda: avisa (onRenovar) cuando llega la medianoche. */
function useAhora(onRenovar) {
  const [ahora, setAhora] = useState(() => new Date());
  const dia = useRef(ahora.toDateString());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setAhora(now);
      if (now.toDateString() !== dia.current) {
        dia.current = now.toDateString();
        onRenovar?.();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [onRenovar]);
  return ahora;
}

function Carta({ item, grande, owned, worn, moneda, onAbrir }) {
  const rareza = RAREZAS[item.rareza];
  return (
    <button
      type="button"
      className={`is-card is-card--${item.rareza.toLowerCase()}${grande ? ' is-card--grande' : ''}${owned ? ' is-card--owned' : ''}`}
      onClick={() => onAbrir(item)}
      aria-label={`${item.name}, ${rareza.nombre}, ${owned ? 'adquirido' : `${item.precio} ${moneda.plural}`}`}
    >
      <span className="is-card-art">
        <Preview id={item.id} className="is-card-canvas" />
      </span>
      <span className="is-card-tags">
        {item.nuevo && !owned && <span className="is-tag is-tag--nuevo">¡Nuevo!</span>}
        {item.oferta && !owned && <span className="is-tag is-tag--oferta">-30%</span>}
        {item.vuelve && <span className="is-tag is-tag--vuelve">Volvió</span>}
        {worn && <span className="is-tag is-tag--puesto">Puesto</span>}
      </span>
      <span className="is-card-foot">
        <span className="is-card-name">{item.name}</span>
        <span className="is-card-meta">
          <span className="is-card-rareza">{rareza.nombre}</span>
          {owned ? (
            <span className="is-card-price is-card-price--owned"><Icon name="check" /> Tuyo</span>
          ) : (
            <span className="is-card-price">
              <Icon name={moneda.icono} />
              {item.oferta && <s>{item.price}</s>}
              {item.precio}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function Detalle({ item, bag, moneda, onComprar, onPoner, onCerrar }) {
  const owned = bag.owned.includes(item.id);
  const worn = bag.equipped === item.id;
  const falta = item.precio - bag.candies;
  return (
    <div className="is-detail-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className={`is-detail is-card--${item.rareza.toLowerCase()}`} role="dialog" aria-modal="true" aria-labelledby="is-detail-name">
        <Preview id={item.id} className="is-detail-canvas" />
        <div className="is-detail-body">
          <p className="is-detail-rareza">{RAREZAS[item.rareza].nombre}{item.temporada === 'NAVIDAD' ? ' · Navidad' : ' · Halloween'}</p>
          <h3 id="is-detail-name">{item.name}</h3>
          <p className="is-detail-desc">{item.description}</p>
          {owned ? (
            <button type="button" className="is-buy" onClick={() => onPoner(item)} autoFocus>
              {worn ? 'Quitármelo' : 'Ponérmelo'}
            </button>
          ) : (
            <button type="button" className="is-buy" onClick={() => onComprar(item)} disabled={falta > 0} autoFocus>
              <Icon name={moneda.icono} /> Comprar por {item.precio}
            </button>
          )}
          {!owned && falta > 0 && (
            <p className="is-detail-falta">Te faltan {falta} {falta === 1 ? moneda.singular : moneda.plural}. La horda los suelta al morir.</p>
          )}
          <button type="button" className="is-detail-close" onClick={onCerrar}>Volver</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tienda de objetos: cada dia (a medianoche) cambia lo que se vende. Dos destacados
 * grandes, cuatro diarios (uno en oferta) y uno de otro evento que vuelve. Lo comprado
 * queda en el casillero para ponerse cuando se quiera. Se paga con lo que suelta la
 * horda (regalos en Navidad, dulces en Halloween).
 */
export default function ItemShop({ onClose }) {
  const { id: temporada, moneda } = useTemporada();
  const [bag, setBag] = useState(getBag);
  const [tab, setTab] = useState('tienda');
  const [abierto, setAbierto] = useState(null);
  const [recien, setRecien] = useState(null);
  const [version, setVersion] = useState(0);
  const ahora = useAhora(useMemo(() => () => setVersion((v) => v + 1), []));
  // La tienda se recalcula al cambiar de dia (version) o de temporada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tienda = useMemo(() => tiendaDelDia(new Date(), temporada), [temporada, version]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (abierto) setAbierto(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, onClose]);

  const comprar = (item) => {
    if (buyCostume(item.id, item.precio)) {
      playSfx('coins');
      setRecien(item.id);
      setTimeout(() => setRecien(null), 1600);
      setAbierto(null);
    } else {
      playSfx('empty');
    }
    setBag(getBag());
  };

  const poner = (item) => {
    equipCostume(bag.equipped === item?.id ? null : item?.id ?? null);
    playSfx('toggle');
    setBag(getBag());
    setAbierto(null);
  };

  const owned = COSTUMES.filter((c) => bag.owned.includes(c.id));
  const carta = (item, grande = false) => (
    <Carta
      key={item.id}
      item={item}
      grande={grande}
      owned={bag.owned.includes(item.id)}
      worn={bag.equipped === item.id}
      moneda={moneda}
      onAbrir={(it) => {
        playSfx('click');
        setAbierto(it);
      }}
    />
  );

  return (
    <div className="is-overlay" role="dialog" aria-modal="true" aria-labelledby="is-title">
      <div className="is-frost" aria-hidden="true" />
      <header className="is-header">
        <div className="is-title-block">
          <p className="is-kicker">{temporada === 'NAVIDAD' ? 'Juguetería maldita' : 'Mercado de las ánimas'}</p>
          <h2 id="is-title">Tienda de objetos</h2>
        </div>
        <nav className="is-tabs" aria-label="Secciones de la tienda">
          <button type="button" className={tab === 'tienda' ? 'is-tab is-tab--on' : 'is-tab'} aria-pressed={tab === 'tienda'} onClick={() => setTab('tienda')}>
            Tienda
          </button>
          <button type="button" className={tab === 'casillero' ? 'is-tab is-tab--on' : 'is-tab'} aria-pressed={tab === 'casillero'} onClick={() => setTab('casillero')}>
            Casillero <span className="is-tab-count">{owned.length}</span>
          </button>
        </nav>
        <div className="is-wallet" aria-label={`Tienes ${bag.candies} ${moneda.plural}`}>
          <Icon name={moneda.icono} />
          <strong>{bag.candies}</strong>
        </div>
        <button type="button" className="is-close" onClick={onClose} aria-label="Cerrar tienda"><Icon name="close" /></button>
      </header>

      <main className="is-scroll">
        {tab === 'tienda' ? (
          <>
            <p className="is-timer" role="timer" aria-live="off">
              Objetos nuevos en <strong>{reloj(msHastaRenovar(ahora))}</strong>
            </p>
            <div className="is-shelves">
            <section className="is-section" aria-labelledby="is-destacados">
              <h3 id="is-destacados" className="is-section-title">Destacados</h3>
              <div className="is-row is-row--destacados">{tienda.destacados.map((item) => carta(item, true))}</div>
            </section>
            <section className="is-section" aria-labelledby="is-diarios">
              <h3 id="is-diarios" className="is-section-title">Ofertas del día</h3>
              <div className="is-row is-row--diarios">{tienda.diarios.map((item) => carta(item))}</div>
            </section>
            </div>
          </>
        ) : (
          <section className="is-section" aria-labelledby="is-casillero">
            <h3 id="is-casillero" className="is-section-title">Tu casillero</h3>
            {owned.length === 0 ? (
              <p className="is-empty">Todavía no tienes nada. Sobrevive, junta {moneda.plural} y vuelve a la tienda.</p>
            ) : (
              <div className="is-row is-row--diarios">
                {owned.map((c) => carta({ ...c, precio: c.price, oferta: false, vuelve: false }))}
              </div>
            )}
            {bag.equipped && (
              <button type="button" className="is-unequip" onClick={() => poner(null)}>
                Quitarme lo que llevo puesto
              </button>
            )}
            <p className="is-hint">
              {temporada === 'NAVIDAD' ? 'Sin nada puesto, en Navidad llevas el gorrito de lana. ' : ''}
              Lo que te pongas lo ven todos en la partida.
            </p>
          </section>
        )}
      </main>

      {abierto && (
        <Detalle
          item={abierto}
          bag={bag}
          moneda={moneda}
          onComprar={comprar}
          onPoner={poner}
          onCerrar={() => setAbierto(null)}
        />
      )}
      {recien && (
        <div className="is-toast" role="status">
          ¡Es tuyo! Ya lo llevas puesto.
        </div>
      )}
    </div>
  );
}
