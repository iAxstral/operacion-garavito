import { useEffect, useRef, useState } from 'react';
import { COSTUMES, buyCostume, equipCostume, getBag } from '../game/costumes';
import { COSTUME_SIZE, drawCostume } from '../game/costumeArt';
import { playSfx } from '../game/sfx';
import Icon from './Icon';

function Preview({ id }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) drawCostume(ref.current.getContext('2d'), id);
  }, [id]);
  return <canvas ref={ref} width={COSTUME_SIZE} height={COSTUME_SIZE} className="costume-preview" aria-hidden="true" />;
}

/** Tienda de disfraces: se pagan con los dulces que suelta la horda. */
export default function CostumeShop({ onClose }) {
  const [bag, setBag] = useState(getBag);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = (costume) => {
    if (bag.owned.includes(costume.id)) {
      equipCostume(bag.equipped === costume.id ? null : costume.id);
      playSfx('toggle');
    } else if (buyCostume(costume.id)) {
      playSfx('coins');
    } else {
      playSfx('empty');
    }
    setBag(getBag());
  };

  return (
    <div className="settings-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="settings-panel costume-panel" role="dialog" aria-modal="true" aria-labelledby="costume-title">
        <header className="settings-header">
          <h2 id="costume-title"><Icon name="pumpkin" /> Disfraces</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </header>
        <p className="costume-bag">
          Tienes <strong>{bag.candies}</strong> dulces. Algunos zombis los sueltan al morir; se suman al terminar cada corrida.
        </p>
        <div className="costume-grid">
          {COSTUMES.map((costume) => {
            const owned = bag.owned.includes(costume.id);
            const worn = bag.equipped === costume.id;
            const affordable = bag.candies >= costume.price;
            return (
              <button
                key={costume.id}
                type="button"
                className={`costume-card${worn ? ' costume-card--worn' : ''}${!owned && !affordable ? ' costume-card--locked' : ''}`}
                onClick={() => act(costume)}
              >
                <Preview id={costume.id} />
                <strong>{costume.name}</strong>
                <small>{costume.description}</small>
                <span className="costume-action">
                  {worn ? 'Puesto (quitar)' : owned ? 'Ponérselo' : <><Icon name="pumpkin" /> {costume.price}</>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
