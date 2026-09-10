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

  connect({ onConnect, onError } = {}) {
    if (this.client?.active) return this.client;

    this.client = new Client({
      webSocketFactory: () => new SockJS(SOCKET_URL),
      reconnectDelay: 5000,
      onConnect: (frame) => onConnect?.(frame),
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
    if (!this.client?.active) {
      throw new Error('Socket client is not connected yet');
    }
    return this.client.subscribe(destination, (message) => {
      callback(JSON.parse(message.body));
    });
  }

  publish(destination, body) {
    if (!this.client?.active) {
      throw new Error('Socket client is not connected yet');
    }
    this.client.publish({ destination, body: JSON.stringify(body) });
  }
}

export const socketService = new SocketService();
