import { io } from 'socket.io-client';

let socketInstance = null;

export const initSocket = (token) => {
  // If socket exists and is connected, return it
  if (socketInstance && socketInstance.connected) {
    console.log('✅ Reusing existing socket connection');
    return socketInstance;
  }

  // If socket exists but disconnected, clean it up
  if (socketInstance) {
    console.log('🧹 Cleaning up disconnected socket');
    socketInstance.removeAllListeners();
    socketInstance.close();
    socketInstance = null;
  }

  // Create new socket connection
  console.log('🔌 Creating new socket connection');
  socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socketInstance.on('connect', () => {
    console.log('✅ Socket connected:', socketInstance.id);
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socketInstance.on('error', (error) => {
    console.error('⚠️ Socket error:', error);
  });

  return socketInstance;
};

export const getSocket = () => socketInstance;

export const closeSocket = () => {
  if (socketInstance) {
    console.log('👋 Closing socket connection');
    socketInstance.removeAllListeners();
    socketInstance.close();
    socketInstance = null;
  }
};
