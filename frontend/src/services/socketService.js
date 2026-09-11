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
  }

  connect({ onConnect, onDisconnect, onError } = {}) {
    if (this.client?.active) return this.client;

    const client = new Client({
      webSocketFactory: () => new SockJS(SOCKET_URL),
      reconnectDelay: 5000,
    });
    // Callbacks from a client that was already replaced/disconnected are
    // dropped: StrictMode mounts twice, and the first client's late close
    // event must not overwrite the second client's "connected" state.
    const isCurrent = () => this.client === client;
    client.onConnect = (frame) => isCurrent() && onConnect?.(frame);
    client.onWebSocketClose = (event) => isCurrent() && onDisconnect?.(event);
    client.onStompError = (frame) => isCurrent() && onError?.(frame);

    this.client = client;
    client.activate();
    return client;
  }

  disconnect() {
    this.client?.deactivate();
    this.client = null;
  }

  isConnected() {
    return Boolean(this.client?.connected);
  }

  subscribe(destination, callback) {
    if (!this.isConnected()) {
      throw new Error('Socket client is not connected yet');
    }
    return this.client.subscribe(destination, (message) => {
      callback(JSON.parse(message.body));
    });
  }

  publish(destination, body) {
    if (!this.isConnected()) {
      throw new Error('Socket client is not connected yet');
    }
    this.client.publish({ destination, body: JSON.stringify(body) });
  }
}

export const socketService = new SocketService();
