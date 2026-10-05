import { useEffect, useRef, useState } from 'react';
import {
  getLatestState,
  getMyRole,
  getNearMission,
  getZombies,
  isTouchDevice,
} from '../game/gameSync';
import { getSettings } from '../game/settings';
import { TIPS, hasSeen, markSeen } from '../game/tutorial';
import { abilityFor } from '../game/abilityCatalog';
import { weaponForItem } from '../game/weaponCatalog';
import { playSfx } from '../game/sfx';
import { Glyph } from './Icon';

const CHECK_MS = 500;
const SHOW_MS = 9000;
const GAP_MS = 1500;

function context(startedAt) {
  const state = getLatestState();
  const me = state.players.find((p) => p.playerId === getMyRole());
  const ability = abilityFor(getMyRole());
  return {
    inGame: Boolean(me),
    touch: isTouchDevice(),
    secondsInGame: (Date.now() - startedAt) / 1000,
    missions: me?.missions?.length ?? 0,
    nearMission: Boolean(getNearMission()),
    zombieWindingUp: getZombies().some((z) => z.floor === me?.floor && z.phase === 'WINDUP'
      && Math.hypot(z.x - me.x, z.y - me.y) < 400),
    garavitos: me?.garavitos ?? 0,
    hasWeapon: (me?.inventory ?? []).some((slot) => weaponForItem(slot.itemId)),
    health: me?.health ?? 100,
    allyDown: me?.lifeState !== 'DOWNED' && state.players.some((p) => p.playerId !== getMyRole() && p.lifeState === 'DOWNED'),
    isMedic: getMyRole() === 'SALUD',
    abilityName: ability.name,
    abilityHint: ability.hint,
  };
}

/** Muestra de a una las ayudas de primera vez, abajo al centro. */
export default function TutorialHints() {
  const [tip, setTip] = useState(null);
  const startedAtRef = useRef(0);
  const nextAllowedAtRef = useRef(0);

  useEffect(() => {
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    const interval = setInterval(() => {
      if (!getSettings().tips || tip || Date.now() < nextAllowedAtRef.current) return;
      const ctx = context(startedAtRef.current);
      const next = TIPS.find((entry) => !hasSeen(entry.id) && entry.when(ctx));
      if (!next) return;
      markSeen(next.id);
      setTip({ id: next.id, icon: next.icon, text: next.text(ctx) });
      playSfx('toggle');
    }, CHECK_MS);
    return () => clearInterval(interval);
  }, [tip]);

  useEffect(() => {
    if (!tip) return undefined;
    const timeout = setTimeout(() => {
      setTip(null);
      nextAllowedAtRef.current = Date.now() + GAP_MS;
    }, SHOW_MS);
    return () => clearTimeout(timeout);
  }, [tip]);

  if (!tip) return null;

  return (
    <div className="tutorial-tip" role="status">
      <span className="tutorial-tip-icon" aria-hidden="true"><Glyph value={tip.icon} /></span>
      <p>{tip.text}</p>
      <button
        type="button"
        className="tutorial-tip-close"
        onClick={() => {
          setTip(null);
          nextAllowedAtRef.current = Date.now() + GAP_MS;
        }}
      >
        Entendido
      </button>
    </div>
  );
}
