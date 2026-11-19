import { useEffect, useState } from 'react';
import { socketService } from '../services/socketService';

// Solo aparece si se cae la conexion con el servidor: el cliente STOMP reintenta solo.
export default function ConnectionStatus() {
  const [status, setStatus] = useState(socketService.status);

  useEffect(() => socketService.onStatusChange(setStatus), []);

  if (status !== 'disconnected') return null;

  return (
    <div className="connection-status" role="status">
      <span className="connection-status-dot" aria-hidden="true" />
      Se perdió la conexión con el servidor. Reconectando…
    </div>
  );
}
