import { useEffect, useRef, useState } from 'react';
import { socketService } from '../services/socketService';

const TEST_TOPIC = '/topic/game/test';
const TEST_DESTINATION = '/app/game/test';

export default function ConnectionStatus() {
  const [status, setStatus] = useState('connecting');
  const [lastEcho, setLastEcho] = useState(null);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    socketService.connect({
      onConnect: () => {
        setStatus('connected');
        subscriptionRef.current = socketService.subscribe(TEST_TOPIC, (payload) => {
          setLastEcho(payload.text);
        });
      },
      onError: () => setStatus('error'),
    });

    return () => {
      // Ojo: NO se llama a socketService.disconnect() aca. El socket es un
      // singleton compartido — Hud.jsx y MainScene.js (via gameSync) tambien
      // dependen de que siga activo. Desconectarlo cuando ESTE componente se
      // desmonta rompia a los demas consumidores (visible sobre todo con el
      // doble mount/unmount de React StrictMode en dev).
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  const sendPing = () => {
    socketService.publish(TEST_DESTINATION, { text: `ping @ ${new Date().toLocaleTimeString()}` });
  };

  return (
    <div className="connection-status">
      <span>WebSocket: {status}</span>
      <button type="button" onClick={sendPing} disabled={status !== 'connected'}>
        Enviar ping de prueba
      </button>
      {lastEcho && <span>Último eco: {lastEcho}</span>}
    </div>
  );
}
