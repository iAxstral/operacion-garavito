import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const SOCKET_URL = import.meta.env.VITE_WS_URL
  ?? `${window.location.protocol}//${window.location.hostname}:8080/ws`;

/** Base de la API REST del mismo servidor (p. ej. /api/ranking). */
export const API_BASE = SOCKET_URL.replace(/\/ws\/?$/, '');

class SocketService {
  constructor() {
    this.client = null;
    this.connectListeners = new Set();
    this.statusListeners = new Set();
    this.status = 'connecting';
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  /** 'connecting' | 'connected' | 'disconnected'. Llama de inmediato con el estado actual. */
  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  connect({ onConnect, onError } = {}) {
    if (onConnect) this.connectListeners.add(onConnect);

    if (this.client?.connected) {
      onConnect?.();
      return this.client;
    }
    if (this.client) return this.client;

    this.client = new Client({
      webSocketFactory: () => new SockJS(SOCKET_URL),
      reconnectDelay: 5000,
      onConnect: (frame) => {
        this.setStatus('connected');
        this.connectListeners.forEach((cb) => cb(frame));
      },
      onWebSocketClose: () => this.setStatus('disconnected'),
      onStompError: (frame) => onError?.(frame),
    });

    this.client.activate();
    return this.client;
  }

  isConnected() {
    return Boolean(this.client?.connected);
  }

  whenConnected() {
    return new Promise((resolve) => {
      if (this.isConnected()) {
        resolve();
        return;
      }
      const listener = () => {
        this.connectListeners.delete(listener);
        resolve();
      };
      this.connect({ onConnect: listener });
    });
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

if (import.meta.env.DEV) {
  // Para pruebas: simular un corte con window.__socket.client.forceDisconnect().
  window.__socket = socketService;
}
