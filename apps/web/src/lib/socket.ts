import { io, Socket } from 'socket.io-client';

// In production, WebSocket needs to connect directly to the backend (Render)
// HTTP API calls use Next.js rewrites, but WebSocket doesn't support rewrites
const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'https://ra-trivia.onrender.com')
  : (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000');

export function createSocket(token?: string): Socket {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
  });
}
