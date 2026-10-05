import { lazy, Suspense, useEffect, useState } from 'react';
// Phaser (la mayor parte del peso) solo se descarga al entrar a la partida: el menu y
// la sala abren rapido aun en el celular.
const GameCanvas = lazy(() => import('./game/GameCanvas'));
import Hud from './components/Hud';
import SecurityMission from './components/SecurityMission';
import WiresMission from './components/WiresMission';
import MathMission from './components/MathMission';
import StackMission from './components/StackMission';
import CodeMission from './components/CodeMission';
import VaccineMission from './components/VaccineMission';
import CashMission from './components/CashMission';
import FuseMission from './components/FuseMission';
import RondaMission from './components/RondaMission';
import SensoresMission from './components/SensoresMission';
import PulsoMission from './components/PulsoMission';
import MedicamentosMission from './components/MedicamentosMission';
import PresupuestoMission from './components/PresupuestoMission';
import FacturasMission from './components/FacturasMission';
import TuberiasMission from './components/TuberiasMission';
import NivelMission from './components/NivelMission';
import TouchControls from './components/TouchControls';
import SpectatorPanel from './components/SpectatorPanel';
import TutorialHints from './components/TutorialHints';
import PhonePanel from './components/PhonePanel';
import TreasuryPanel from './components/TreasuryPanel';
import GameOverScreen from './components/GameOverScreen';
import ConnectionStatus from './components/ConnectionStatus';
import MainMenu from './components/MainMenu';
import BuildingSelect from './components/BuildingSelect';
import RoleSelect from './components/RoleSelect';
import LobbyEntry from './components/LobbyEntry';
import WaitingRoom from './components/WaitingRoom';
import { leaveGame, resumeSession } from './game/gameSync';
import { startAmbience, stopAmbience } from './game/ambience';
import './App.css';
import './halloween.css';
import './minigames.css';

function App() {
  const [view, setView] = useState('menu');
  const [building, setBuilding] = useState(null);

  // Si se recargo la pagina en medio de una partida, se vuelve al mismo puesto.
  useEffect(() => {
    let cancelled = false;
    resumeSession().then((resumed) => {
      if (!cancelled && resumed) setView(resumed.started ? 'playing' : 'waiting');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cada pantalla entra con un fundido desde negro (la clave reinicia la animacion).
  const fade = (screen) => <div key={view} className="hw-screen">{screen}</div>;

  // Viento y crujidos en las pantallas de afuera; adentro del edificio suena la partida.
  useEffect(() => {
    if (view === 'playing') stopAmbience();
    else startAmbience();
  }, [view]);

  const handleExitToMenu = () => {
    leaveGame();
    setView('menu');
  };

  if (view === 'menu') {
    return fade(<MainMenu onPlay={() => setView('buildings')} />);
  }

  if (view === 'buildings') {
    return fade(
      <BuildingSelect
        onSelect={(id) => {
          setBuilding(id);
          setView('lobby');
        }}
        onBack={() => setView('menu')}
      />
    );
  }

  if (view === 'lobby') {
    return fade(
      <LobbyEntry
        building={building}
        onEntered={() => setView('roles')}
        onBack={() => setView('buildings')}
      />
    );
  }

  if (view === 'roles') {
    return fade(
      <RoleSelect
        onJoined={() => setView('waiting')}
        onBack={() => {
          leaveGame();
          setView('lobby');
        }}
      />
    );
  }

  if (view === 'waiting') {
    return fade(
      <WaitingRoom
        onStarted={() => setView('playing')}
        onLeave={() => {
          leaveGame();
          setView('lobby');
        }}
      />
    );
  }

  return (
    <div id="game-root" className="hw-screen">
      <div className="game-stage">
        <Suspense fallback={<div className="game-loading">Cargando el edificio…</div>}>
          <GameCanvas />
        </Suspense>
        <Hud />
        <SecurityMission />
        <WiresMission />
        <MathMission />
        <StackMission />
        <CodeMission />
        <VaccineMission />
        <CashMission />
        <FuseMission />
        <RondaMission />
        <SensoresMission />
        <PulsoMission />
        <MedicamentosMission />
        <PresupuestoMission />
        <FacturasMission />
        <TuberiasMission />
        <NivelMission />
        <TouchControls />
        <SpectatorPanel />
        <TutorialHints />
        <PhonePanel />
        <TreasuryPanel />
        <GameOverScreen onExitToMenu={handleExitToMenu} />
      </div>
      <ConnectionStatus />
    </div>
  );
}

export default App;
