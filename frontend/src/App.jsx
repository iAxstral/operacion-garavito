import { useState } from 'react';
import GameCanvas from './game/GameCanvas';
import Hud from './components/Hud';
import SecurityMission from './components/SecurityMission';
import GameOverScreen from './components/GameOverScreen';
import ConnectionStatus from './components/ConnectionStatus';
import MainMenu from './components/MainMenu';
import { leaveGame } from './game/gameSync';
import './App.css';

function App() {
  const [view, setView] = useState('menu'); // 'menu' | 'playing'

  const handleExitToMenu = () => {
    leaveGame();
    setView('menu');
  };

  if (view === 'menu') {
    return <MainMenu onPlay={() => setView('playing')} />;
  }

  return (
    <div id="game-root">
      <div className="game-stage">
        <GameCanvas />
        <Hud />
        <SecurityMission />
        <GameOverScreen onExitToMenu={handleExitToMenu} />
      </div>
      <ConnectionStatus />
    </div>
  );
}

export default App;
