import { io, Socket } from 'socket.io-client';

// Use the same URL logic as api.ts for consistency
const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');

// Remove /api suffix for socket connection
const BASE_SOCKET_URL = SOCKET_URL.replace('/api', '');

export function createSocket(token?: string): Socket {
  return io(BASE_SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
  });
}
