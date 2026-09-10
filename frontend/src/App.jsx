import GameCanvas from './game/GameCanvas';
import ConnectionStatus from './components/ConnectionStatus';
import './App.css';

function App() {
  return (
    <div id="game-root">
      <h1>Operación Garavito</h1>
      <GameCanvas />
      <ConnectionStatus />
    </div>
  );
}

export default App;
