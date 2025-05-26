import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(SOCKET_URL, {
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        socket.on('connect', () => {
            console.log(`[Socket] Connected with id ${socket!.id}`);
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket] Disconnected. Reason: ${reason}`);
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);
        });
    }
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}