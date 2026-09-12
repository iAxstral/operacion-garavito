import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const SOCKET_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:8080/ws';

/**
 * Thin wrapper around a single STOMP client. Sprint 1 scope: connect,
 * subscribe, publish a test message. Decision payloads and the
 * RoundCoordinator protocol are added once that backend piece exists.
 */
class SocketService {
  constructor() {
    this.client = null;
    this.connectListeners = new Set();
  }

  /**
   * Varias partes de la UI (HUD, panel de conexion, MainScene) llaman a
   * connect() de forma independiente. Todas quedan registradas como
   * listeners; si el socket ya esta activo cuando alguien llama a connect,
   * se le avisa de inmediato en vez de esperar un evento onConnect que ya
   * paso.
   */
  connect({ onConnect, onError } = {}) {
    if (onConnect) this.connectListeners.add(onConnect);

    // client.active se pone en true casi de inmediato al llamar activate()
    // — antes de que el handshake STOMP realmente termine. client.connected
    // es la senal real de "listo para publish/subscribe".
    if (this.client?.connected) {
      onConnect?.();
      return this.client;
    }
    if (this.client) return this.client; // ya se esta activando/conectando

    this.client = new Client({
      webSocketFactory: () => new SockJS(SOCKET_URL),
      reconnectDelay: 5000,
      onConnect: (frame) => this.connectListeners.forEach((cb) => cb(frame)),
      onStompError: (frame) => onError?.(frame),
    });

    this.client.activate();
    return this.client;
  }

  disconnect() {
    this.client?.deactivate();
    this.client = null;
  }

  subscribe(destination, callback) {
    if (!this.client?.connected) {
      throw new Error('Socket client is not connected yet');
    }
    return this.client.subscribe(destination, (message) => {
      callback(JSON.parse(message.body));
    });
  }

  publish(destination, body) {
    if (!this.client?.connected) {
      throw new Error('Socket client is not connected yet');
    }
    this.client.publish({ destination, body: JSON.stringify(body) });
  }
}

export const socketService = new SocketService();
