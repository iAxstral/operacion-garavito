import { useEffect, useState } from 'react';
import { getMyPlayerState, onStateChange, requestPerk } from '../game/gameSync';
import { PERKS } from '../game/perks';
import { playSfx } from '../game/sfx';

// En el respiro entre Kinders el servidor ofrece tres mejoras; aqui se elige una.
// Teclas 1, 2 y 3 en el computador.
export default function PerkPanel() {
  const [offer, setOffer] = useState([]);
  const [owned, setOwned] = useState([]);

  useEffect(() => onStateChange(() => {
    const me = getMyPlayerState();
    const nextOffer = me?.perkOffer ?? [];
    const nextOwned = me?.perks ?? [];
    setOffer((old) => (old.join() === nextOffer.join() ? old : nextOffer));
    setOwned((old) => (old.join() === nextOwned.join() ? old : nextOwned));
  }), []);

  useEffect(() => {
    if (offer.length === 0) return undefined;
    const onKey = (event) => {
      const index = Number(event.key) - 1;
      if (event.repeat || !(index >= 0 && index < offer.length)) return;
      event.preventDefault();
      pick(offer[index]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offer]);

  if (offer.length === 0) {
    return owned.length > 0 ? (
      <div className="perk-owned" aria-label="Mejoras">
        {owned.map((perk) => (
          <span key={perk} title={`${PERKS[perk]?.label}: ${PERKS[perk]?.text}`}>{PERKS[perk]?.icon ?? '★'}</span>
        ))}
      </div>
    ) : null;
  }

  return (
    <div className="perk-panel" role="dialog" aria-label="Elige una mejora">
      <h3>Elige una mejora</h3>
      <div className="perk-cards">
        {offer.map((perk, i) => (
          <button key={perk} type="button" className="perk-card" onClick={() => pick(perk)}>
            <span className="perk-card-icon" aria-hidden="true">{PERKS[perk]?.icon}</span>
            <strong>{PERKS[perk]?.label ?? perk}</strong>
            <small>{PERKS[perk]?.text}</small>
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </div>
    </div>
  );
}

function pick(perk) {
  playSfx('click');
  requestPerk(perk);
}
