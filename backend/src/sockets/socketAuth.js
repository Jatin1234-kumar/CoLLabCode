import { verifyToken } from '../utils/jwt.js';
import { socketResponse, sendError } from '../utils/response.js';
import { ERROR_CODES, USER_ROLES } from '../utils/constants.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import Version from '../models/Version.js';

// Map to track socket user context
export const socketUserMap = new Map();

// Verify socket token and attach user
export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token is required'));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid or expired token'));
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id;
    socket.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      displayName: user.displayName,
    };

    socketUserMap.set(socket.id, {
      userId: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
    });

    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication failed'));
  }
};

// Helper to get user role in room
export const getUserRoleInRoom = (room, userId) => {
  const participant = room.participants.find((p) => {
    const pUserId = typeof p.userId === 'object' ? p.userId._id : p.userId;
    return pUserId.toString() === userId.toString();
  });
  return participant ? participant.role : null;
};

// Helper to check if user is approved participant
export const isApprovedParticipant = (room, userId) => {
  return room.participants.some((p) => {
    const pUserId = typeof p.userId === 'object' ? p.userId._id : p.userId;
    return pUserId.toString() === userId.toString();
  });
};

// Helper to check user permissions
export const checkPermission = (role, requiredRoles) => {
  return requiredRoles.includes(role);
};

// Emit to room
export const emitToRoom = (io, roomId, eventName, data) => {
  console.log(`📡 emitToRoom called: event=${eventName}, room=room:${roomId}, io=${io ? 'VALID' : 'NULL'}`);
  try {
    const room = io.sockets.adapter.rooms.get(`room:${roomId}`);
    const socketCount = room ? room.size : 0;
    console.log(`📊 emitToRoom: Found ${socketCount} sockets in room:${roomId}`);
    
    io.to(`room:${roomId}`).emit(eventName, data);
    console.log(`✅ emitToRoom: Successfully emitted ${eventName} to ${socketCount} sockets`);
  } catch (err) {
    console.error(`❌ emitToRoom error:`, err.message);
  }
};

// Emit to user
export const emitToUser = (io, userId, eventName, data) => {
  io.to(`user:${userId}`).emit(eventName, data);
};
