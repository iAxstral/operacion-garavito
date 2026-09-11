import GameCanvas from './game/GameCanvas';
import Hud from './components/Hud';
import ConnectionStatus from './components/ConnectionStatus';
import './App.css';

function App() {
  return (
    <div id="game-root">
      <h1>Operación Garavito</h1>
      <div className="game-stage">
        <GameCanvas />
        <Hud />
      </div>
      <ConnectionStatus />
    </div>
  );
}

export default App;
