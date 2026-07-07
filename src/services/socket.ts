import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const token = getToken();
    // Connect to same origin
    socketInstance = io({
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('[AlignHub Socket] Connected to real-time server as', socketInstance?.id);
    });

    socketInstance.on('disconnect', () => {
      console.log('[AlignHub Socket] Disconnected from real-time server');
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[AlignHub Socket] Connection error:', err.message);
    });
  }
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function resetSocket() {
  disconnectSocket();
  return getSocket();
}
