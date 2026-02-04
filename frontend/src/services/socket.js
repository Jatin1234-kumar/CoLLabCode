import { io } from 'socket.io-client';

let socketInstance = null;

export const initSocket = (token) => {
  if (socketInstance) {
    return socketInstance;
  }

  socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socketInstance.on('connect', () => {
    console.log('Socket connected');
  });

  socketInstance.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socketInstance.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socketInstance;
};

export const getSocket = () => socketInstance;

export const closeSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
