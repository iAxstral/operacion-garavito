import { useEffect, useState } from 'react';
import { getLatestState, getMyRole, onGameEvent, setInputLocked } from '../game/gameSync';
import { nameWithRole } from '../game/profile';
import { playSfx } from '../game/sfx';
import RankingPanel from './RankingPanel';
import Icon from './Icon';
import { earnAchievements } from '../game/achievements';
import { creditRun } from '../game/costumes';
import Credits from './Credits';
import { recordRun } from '../game/playerStats';
import { startReplayRecorder, takeBestPlay } from '../game/replayRecorder';
import ReplayViewer from './ReplayViewer';

const OUTCOMES = {
  TEAM_WIPED: {
    title: 'Derrota',
    text: 'Cayó todo el equipo. La corrida vuelve a empezar desde el Kinder 1.',
    canRetry: true,
  },
  VICTORY: {
    title: '¡Victoria!',
    text: 'Superaron los 5 Kinders y el edificio quedó despejado.',
    canRetry: false,
  },
};

// Reconocimientos: quien mas hizo cada cosa (solo si hizo algo).
const AWARDS = [
  { key: 'kills', icon: 'zombie', label: 'Exterminador' },
  { key: 'missions', icon: 'scroll', label: 'Cumplidor' },
  { key: 'revives', icon: 'cross', label: 'Salvavidas' },
  { key: 'garavitosEarned', icon: 'coin', label: 'Proveedor' },
];

function awardsFor(players) {
  const awards = new Map();
  AWARDS.forEach((award) => {
    const best = Math.max(0, ...players.map((p) => p[award.key]));
    if (best <= 0) return;
    players.filter((p) => p[award.key] === best).forEach((p) => {
      awards.set(p.role, [...(awards.get(p.role) ?? []), award]);
    });
  });
  return awards;
}

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Pantalla de resultados al ganar o al caer todo el equipo, con las estadisticas de la corrida. */
export default function GameOverScreen({ onExitToMenu }) {
  const [outcome, setOutcome] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showRanking, setShowRanking] = useState(false);
  const [earned, setEarned] = useState([]);
  const [candies, setCandies] = useState(0);
  const [showCredits, setShowCredits] = useState(false);
  const [bestPlay, setBestPlay] = useState(null);
  const [showReplay, setShowReplay] = useState(false);

  useEffect(() => startReplayRecorder(), []);

  useEffect(() => onGameEvent((event) => {
    if (!OUTCOMES[event.type]) return;
    setOutcome(OUTCOMES[event.type]);
    // El resumen viaja en el mismo mensaje que el evento.
    const runSummary = getLatestState().summary ?? null;
    setSummary(runSummary);
    setEarned(earnAchievements(runSummary, getMyRole()));
    recordRun(runSummary, getMyRole());
    setBestPlay(takeBestPlay());
    const mine = runSummary?.players?.find((p) => p.role === getMyRole());
    setCandies(runSummary ? creditRun(runSummary.id, mine?.candies ?? 0) : 0);
    setInputLocked(true);
    setShowCredits(event.type === 'VICTORY');
    playSfx(event.type === 'VICTORY' ? 'coins' : 'breakWood');
  }), []);

  if (!outcome) return null;
  if (showCredits) {
    return <Credits survivors={summary?.players ?? []} onClose={() => setShowCredits(false)} />;
  }

  const handleRetry = () => {
    setOutcome(null);
    setInputLocked(false);
  };

  const handleExit = () => {
    setOutcome(null);
    setInputLocked(false);
    onExitToMenu();
  };

  const players = summary?.players ?? [];
  const awards = awardsFor(players);

  return (
    <div className="game-over-screen">
      <div className={`game-over-panel results-panel${summary?.victory ? ' results-panel--victory' : ''}`}>
        <h2>{outcome.title}</h2>
        <p>{outcome.text}</p>
        {summary && (
          <div className="results-meta">
            <span><strong>{summary.victory ? 'Los 5' : `Kinder ${summary.kinderReached}`}</strong> {summary.victory ? 'Kinders' : 'alcanzado'}</span>
            <span><strong>{formatTime(summary.durationSeconds)}</strong> de partida</span>
            <span><strong>{players.reduce((sum, p) => sum + p.kills, 0)}</strong> zombis</span>
          </div>
        )}

        {players.length > 0 && (
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th scope="col">Rol</th>
                  <th scope="col"><Icon name="zombie" title="Zombis eliminados" /></th>
                  <th scope="col"><Icon name="scroll" title="Misiones completadas" /></th>
                  <th scope="col"><Icon name="coin" title="Garavitos ganados" /></th>
                  <th scope="col"><Icon name="cross" title="Compañeros revividos" /></th>
                  <th scope="col"><Icon name="heart" title="Daño recibido" /></th>
                  <th scope="col"><Icon name="skull" title="Veces que cayó" /></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.role} className={p.role === getMyRole() ? 'results-me' : undefined}>
                    <th scope="row">
                      {nameWithRole(p)}{p.role === getMyRole() ? ' (tú)' : ''}
                      {awards.get(p.role) && (
                        <span className="results-awards">
                          {awards.get(p.role).map((award) => (
                            <span key={award.key}><Icon name={award.icon} /> {award.label} </span>
                          ))}
                        </span>
                      )}
                    </th>
                    <td>{p.kills}</td>
                    <td>{p.missions}</td>
                    <td>{p.garavitosEarned}</td>
                    <td>{p.revives}</td>
                    <td>{p.damageTaken}</td>
                    <td>{p.downs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {candies > 0 && (
          <p className="results-candies"><Icon name="pumpkin" /> +{candies} dulces a tu bolsa: cámbialos por disfraces en el menú</p>
        )}

        {earned.length > 0 && (
          <div className="results-achievements">
            <h3>Logros</h3>
            <div className="achievement-list">
              {earned.map((a) => (
                <div key={a.id} className={`achievement${a.isNew ? ' achievement--new' : ''}`}>
                  <Icon name={a.icon} />
                  <span>
                    <strong>{a.name}</strong>
                    <small>{a.description}</small>
                  </span>
                  {a.isNew && <em>¡Nuevo!</em>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="game-over-actions">
          {outcome.canRetry && (
            <button type="button" className="game-over-btn game-over-btn--primary" onClick={handleRetry}>
              Reintentar
            </button>
          )}
          {bestPlay && (
            <button type="button" className="game-over-btn" onClick={() => setShowReplay(true)} title={bestPlay.title}>
              ⏪ Mejor jugada
            </button>
          )}
          {summary?.victory && (
            <button type="button" className="game-over-btn" onClick={() => setShowCredits(true)}>
              Créditos
            </button>
          )}
          <button type="button" className="game-over-btn" onClick={() => setShowRanking(true)}>
            <Icon name="trophy" /> Ranking
          </button>
          <button
            type="button"
            className={`game-over-btn${outcome.canRetry ? '' : ' game-over-btn--primary'}`}
            onClick={handleExit}
          >
            Menú principal
          </button>
        </div>
      </div>
      {showRanking && <RankingPanel initialBuilding={summary?.building} onClose={() => setShowRanking(false)} />}
      {showReplay && bestPlay && <ReplayViewer play={bestPlay} onClose={() => setShowReplay(false)} />}
    </div>
  );
}
