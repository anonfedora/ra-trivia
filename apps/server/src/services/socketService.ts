import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;

export const initSocketIO = (socketServer: SocketIOServer) => {
    io = socketServer;

    io.use((socket: Socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) return next(new Error('Authentication required'));

        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; role: string };
            (socket as any).userId = payload.userId;
            (socket as any).role = payload.role;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const userId = (socket as any).userId as string;
        // Each user joins their own private room
        socket.join(`user:${userId}`);
        console.log(`[SOCKET] User ${userId} connected (${socket.id})`);

        socket.on('disconnect', () => {
            console.log(`[SOCKET] User ${userId} disconnected (${socket.id})`);
        });
    });

    console.log('🔌 Socket.IO initialized');
};

/**
 * Emit a notification event to a specific user's room.
 * Call this whenever a notification is created for a user.
 */
export const emitNotification = (userId: string, notification: object) => {
    if (!io) return;
    io.to(`user:${userId}`).emit('notification', notification);
};

/**
 * Emit to all connected SUPER_ADMIN sockets.
 * Used for admin-scoped notifications where createdById = superAdmin.id.
 */
export const emitToRoom = (room: string, event: string, data: object) => {
    if (!io) return;
    io.to(room).emit(event, data);
};
