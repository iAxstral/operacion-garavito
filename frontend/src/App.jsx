import { useState } from 'react';
import GameCanvas from './game/GameCanvas';
import Hud from './components/Hud';
import SecurityMission from './components/SecurityMission';
import WiresMission from './components/WiresMission';
import MathMission from './components/MathMission';
import StackMission from './components/StackMission';
import TouchControls from './components/TouchControls';
import GameOverScreen from './components/GameOverScreen';
import ConnectionStatus from './components/ConnectionStatus';
import MainMenu from './components/MainMenu';
import BuildingSelect from './components/BuildingSelect';
import RoleSelect from './components/RoleSelect';
import LobbyEntry from './components/LobbyEntry';
import WaitingRoom from './components/WaitingRoom';
import { leaveGame } from './game/gameSync';
import './App.css';

function App() {
  const [view, setView] = useState('menu');
  const [building, setBuilding] = useState(null);

  const handleExitToMenu = () => {
    leaveGame();
    setView('menu');
  };

  if (view === 'menu') {
    return <MainMenu onPlay={() => setView('buildings')} />;
  }

  if (view === 'buildings') {
    return (
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
    return (
      <LobbyEntry
        building={building}
        onEntered={() => setView('roles')}
        onBack={() => setView('buildings')}
      />
    );
  }

  if (view === 'roles') {
    return (
      <RoleSelect
        building={building}
        onJoined={() => setView('waiting')}
        onBack={() => {
          leaveGame();
          setView('lobby');
        }}
      />
    );
  }

  if (view === 'waiting') {
    return (
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
    <div id="game-root">
      <div className="game-stage">
        <GameCanvas />
        <Hud />
        <SecurityMission />
        <WiresMission />
        <MathMission />
        <StackMission />
        <TouchControls />
        <GameOverScreen onExitToMenu={handleExitToMenu} />
      </div>
      <ConnectionStatus />
    </div>
  );
}

export default App;
