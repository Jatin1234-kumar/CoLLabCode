let io = null;

export const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

export const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const emitToRoom = (roomId, event, data) => {
  if (io) {
    console.log(`📤 Emitting ${event} to room:${roomId}`);
    io.to(`room:${roomId}`).emit(event, data);
  } else {
    console.error('⚠️ Socket.io not initialized for emitToRoom');
  }
};

export const emitToUser = (userId, event, data) => {
  if (io) {
    console.log(`📤 Emitting ${event} to user:${userId}`);
    io.to(`user:${userId}`).emit(event, data);
  } else {
    console.error('⚠️ Socket.io not initialized for emitToUser');
  }
};

export const broadcastToAll = (event, data) => {
  if (io) {
    console.log(`📡 Broadcasting ${event} to all connected users`);
    io.emit(event, data);
  } else {
    console.error('⚠️ Socket.io not initialized for broadcastToAll');
  }
};
