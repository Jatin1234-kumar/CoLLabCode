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
    io.to(`room:${roomId}`).emit(event, data);
  }
};

export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};
