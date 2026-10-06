import { useEffect, useState } from 'react';
import { generateLobbyCode, openLobby } from '../game/gameSync';
import { playSfx } from '../game/sfx';
import HalloweenCreatures from './HalloweenCreatures';

const ERROR_MESSAGES = {
  lobby_not_found: 'No existe una sala con ese código.',
  invalid_code: 'El código debe tener 4 letras o números.',
  timeout: 'El servidor no respondió. ¿Estás en la misma red que el anfitrión?',
};

const MAX_CREATE_ATTEMPTS = 5;

// Medidas reales de /mapa/crear-sala-halloween.jpg. Los botones, el campo del codigo y
// los ojos estan en pixeles de esa imagen y se pasan a porcentajes del recorte visible.
const IMAGE_W = 1413;
const IMAGE_H = 752;
const SPOTS = {
  create: [458, 568, 628, 628],
  join: [800, 572, 968, 630],
  back: [643, 676, 782, 728],
  code: [800, 503, 966, 557],
};
const EYES = [[690, 123], [744, 123]];

// En pantallas verticales se muestra solo la franja central (la de los paneles) para
// que los botones queden de un tamano que se pueda tocar.
const CROP_WIDE = [0, 0, IMAGE_W, IMAGE_H];
const CROP_TALL = [360, 0, 700, IMAGE_H];
const TALL_QUERY = '(max-aspect-ratio: 1/1)';

function useTallScreen() {
  const [tall, setTall] = useState(() => window.matchMedia(TALL_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(TALL_QUERY);
    const onChange = () => setTall(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return tall;
}

function boxStyle([x0, y0, x1, y1], [cx, cy, cw, ch]) {
  return {
    left: `${((x0 - cx) / cw) * 100}%`,
    top: `${((y0 - cy) / ch) * 100}%`,
    width: `${((x1 - x0) / cw) * 100}%`,
    height: `${((y1 - y0) / ch) * 100}%`,
  };
}

export default function LobbyEntry({ building, onEntered, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const crop = useTallScreen() ? CROP_TALL : CROP_WIDE;
  const [cx, cy, cw, ch] = crop;

  const run = async (action) => {
    playSfx('click');
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(ERROR_MESSAGES[err.message] ?? 'No se pudo conectar con la sala.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () => run(async () => {
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      try {
        const created = await openLobby(generateLobbyCode(), true, building);
        onEntered(created);
        return;
      } catch (err) {
        if (err.message !== 'code_taken') throw err;
      }
    }
    throw new Error('code_taken');
  });

  const handleJoin = (event) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 4) return;
    run(async () => {
      await openLobby(normalized, false, building);
      onEntered(normalized);
    });
  };

  return (
    <div className="lobby-screen">
      <form
        className={`lobby-stage${busy ? ' lobby-stage--busy' : ''}`}
        style={{ aspectRatio: `${cw} / ${ch}`, '--stage-ratio': cw / ch }}
        onSubmit={handleJoin}
      >
        <img
          className="lobby-stage-art"
          src="/mapa/crear-sala-halloween.jpg"
          alt="Sala de juego: crear sala o unirse con código"
          draggable={false}
          style={{
            width: `${(IMAGE_W / cw) * 100}%`,
            left: `${(-cx / cw) * 100}%`,
            top: `${(-cy / ch) * 100}%`,
          }}
        />
        {EYES.map(([x, y]) => (
          <span
            key={x}
            className="lobby-eye"
            aria-hidden="true"
            style={{ left: `${((x - cx) / cw) * 100}%`, top: `${((y - cy) / ch) * 100}%` }}
          />
        ))}
        <span className="lobby-building-tag">Edificio {building}</span>

        <button
          type="button"
          className="lobby-hotspot"
          style={boxStyle(SPOTS.create, crop)}
          disabled={busy}
          onClick={handleCreate}
          aria-label="Crear sala"
          title="Crear una sala nueva"
        />
        <input
          className="lobby-code-field"
          style={boxStyle(SPOTS.code, crop)}
          value={code}
          maxLength={4}
          placeholder="ABCD"
          aria-label="Código de la sala"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
        <button
          type="submit"
          className="lobby-hotspot"
          style={boxStyle(SPOTS.join, crop)}
          disabled={busy || code.trim().length < 4}
          aria-label="Entrar"
          title={code.trim().length < 4 ? 'Escribe el código de 4 letras' : 'Entrar a la sala'}
        />
        <button
          type="button"
          className="lobby-hotspot lobby-hotspot--back"
          style={boxStyle(SPOTS.back, crop)}
          onClick={() => {
            playSfx('click');
            onBack();
          }}
          aria-label="Volver"
        />
      </form>

      <HalloweenCreatures bats={3} spiders={0} />

      <p className={`lobby-status${error ? ' lobby-status--error' : ''}`} role={error ? 'alert' : undefined}>
        {busy
          ? 'Abriendo la sala…'
          : (error ?? 'Todos en la misma red Wi-Fi: uno crea la sala y los demás entran con su código.')}
      </p>
    </div>
  );
}
