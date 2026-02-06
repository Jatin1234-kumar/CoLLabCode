import {
  socketUserMap,
  getUserRoleInRoom,
  isApprovedParticipant,
  emitToRoom,
} from './socketAuth.js';
import { socketResponse } from '../utils/response.js';
import { ERROR_CODES, USER_ROLES } from '../utils/constants.js';
import Room from '../models/Room.js';
import Version from '../models/Version.js';

const DEBOUNCE_DELAY = 500;
const CURSOR_THROTTLE_DELAY = 100;

const roomDebounceTimers = new Map();
const roomLastCursorUpdate = new Map();

/* ------------------ helpers ------------------ */
const safeCallback = (callback, payload) => {
  if (typeof callback === 'function') {
    callback(payload);
  }
};

/* ------------------ handlers ------------------ */
export const setupSocketHandlers = (io, socket) => {
  /* ===== ROOM EVENTS ===== */

  socket.on('room:join', async (data, callback) => {
    try {
      const { roomId } = data;
      const userId = socket.userId.toString();

      const room = await Room.findById(roomId)
        .populate('owner', 'username displayName')
        .populate('participants.userId', 'username displayName');

      if (!room) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.ROOM_NOT_FOUND, 'Room not found')
        );
      }

      if (!isApprovedParticipant(room, userId)) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.ACCESS_DENIED, 'Not a participant')
        );
      }

      socket.join(`room:${roomId}`);
      socket.join(`user:${userId}`);
      socket.currentRoom = roomId;

      console.log('🚪 Backend: User joined room');
      console.log('📊 Backend: Socket ID:', socket.id, 'Room ID:', roomId, 'Socket rooms after join:', socket.rooms);

      emitToRoom(io, roomId, 'user:joined', {
        user: socket.user,
        role: getUserRoleInRoom(room, userId),
      });

      safeCallback(callback, {
        ...socketResponse(true),
        data: {
          room: {
            id: room._id,
            name: room.name,
            language: room.language,
            code: room.code,
            owner: room.owner,
            participants: room.participants,
          },
        },
      });
    } catch (err) {
      console.error('room:join error:', err);
      safeCallback(
        callback,
        socketResponse(false, ERROR_CODES.INTERNAL_SERVER_ERROR, 'Join failed')
      );
    }
  });

  socket.on('room:leave', async (_, callback) => {
    try {
      const roomId = socket.currentRoom;
      if (!roomId) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.VALIDATION_ERROR, 'Not in a room')
        );
      }

      socket.leave(`room:${roomId}`);
      socket.currentRoom = null;

      emitToRoom(io, roomId, 'user:left', {
        userId: socket.user.id,
        username: socket.user.username,
      });

      safeCallback(callback, socketResponse(true));
    } catch (err) {
      console.error('room:leave error:', err);
      safeCallback(
        callback,
        socketResponse(false, ERROR_CODES.INTERNAL_SERVER_ERROR, 'Leave failed')
      );
    }
  });

  socket.on('participant:role-changed', async (data) => {
    try {
      const { roomId, userId, newRole } = data;
      const requestingUserId = socket.userId.toString();

      const room = await Room.findById(roomId);
      if (!room) return;

      // Only owner can change roles
      if (room.owner.toString() !== requestingUserId) {
        console.error('Unauthorized role change attempt');
        return;
      }

      // Broadcast role change to all users in room
      emitToRoom(io, roomId, 'participant:role-updated', {
        userId,
        newRole,
      });

      // Notify the specific user who got their role changed
      io.to(`user:${userId}`).emit('my:role-changed', {
        roomId,
        newRole,
      });

      console.log(`✅ Role changed for user ${userId} to ${newRole} in room ${roomId}`);
    } catch (err) {
      console.error('participant:role-changed error:', err);
    }
  });

  /* ===== CODE SYNC ===== */

  socket.on('code:update', async (data, callback) => {
    try {
      const { roomId, code, timestamp } = data;
      const userId = socket.userId.toString();

      console.log('📤 Backend: code:update received!');
      console.log('📊 Backend: Data:', { roomId, codeLength: code?.length, userId, socketId: socket.id });
      
      if (!roomId || code === undefined) {
        console.warn('⚠️ Backend: Invalid data in code:update');
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.VALIDATION_ERROR, 'Invalid data')
        );
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.ROOM_NOT_FOUND, 'Room not found')
        );
      }

      if (!isApprovedParticipant(room, userId)) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.ACCESS_DENIED, 'Not authorized')
        );
      }

      if (getUserRoleInRoom(room, userId) === USER_ROLES.VIEWER) {
        return safeCallback(
          callback,
          socketResponse(
            false,
            ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            'Viewers cannot edit'
          )
        );
      }

      const serverTimestamp = Date.now();
      room.code = code;
      room.lastModified = new Date(serverTimestamp);

      if (roomDebounceTimers.has(roomId)) {
        clearTimeout(roomDebounceTimers.get(roomId));
      }

      roomDebounceTimers.set(
        roomId,
        setTimeout(() => room.save(), DEBOUNCE_DELAY)
      );

      console.log('📡 Backend: Broadcasting code:updated to room:', roomId);
      console.log('📊 Backend: Broadcasting data:', { codeLength: code.length, userId, timestamp: serverTimestamp });
      emitToRoom(io, roomId, 'code:updated', {
        code,
        userId: socket.user.id,
        username: socket.user.username,
        timestamp: serverTimestamp,
      });

      safeCallback(callback, socketResponse(true));
    } catch (err) {
      console.error('code:update error:', err);
      safeCallback(
        callback,
        socketResponse(false, ERROR_CODES.INTERNAL_SERVER_ERROR, 'Update failed')
      );
    }
  });

  /* ===== CURSOR ===== */

  socket.on('cursor:update', async (data, callback) => {
    try {
      const { roomId, position, line } = data;
      const userId = socket.userId.toString();

      if (!roomId || position === undefined || line === undefined) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.VALIDATION_ERROR, 'Invalid data')
        );
      }

      const room = await Room.findById(roomId);
      if (!room || !isApprovedParticipant(room, userId)) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.ACCESS_DENIED, 'Not authorized')
        );
      }

      const key = `${roomId}:${userId}`;
      const last = roomLastCursorUpdate.get(key) || 0;
      if (Date.now() - last < CURSOR_THROTTLE_DELAY) {
        return safeCallback(callback, socketResponse(true));
      }

      roomLastCursorUpdate.set(key, Date.now());

      socket.to(`room:${roomId}`).emit('cursor:updated', {
        userId: socket.user.id,
        username: socket.user.username,
        position,
        line,
      });

      safeCallback(callback, socketResponse(true));
    } catch (err) {
      console.error('cursor:update error:', err);
      safeCallback(
        callback,
        socketResponse(false, ERROR_CODES.INTERNAL_SERVER_ERROR, 'Cursor failed')
      );
    }
  });

  /* ===== VERSIONING ===== */

  socket.on('version:save', async (data, callback) => {
    try {
      const { roomId, label } = data;
      const userId = socket.userId.toString();

      const room = await Room.findById(roomId);
      if (!room) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.ROOM_NOT_FOUND, 'Room not found')
        );
      }

      const role = getUserRoleInRoom(room, userId);
      if (![USER_ROLES.OWNER, USER_ROLES.EDITOR].includes(role)) {
        return safeCallback(
          callback,
          socketResponse(
            false,
            ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            'Cannot save version'
          )
        );
      }

      // Ensure code is a string and save room first (in case of pending debounced saves)
      const codeToSave = room.code && typeof room.code === 'string' ? room.code : '';
      
      // Flush any pending debounced save
      if (roomDebounceTimers.has(roomId)) {
        clearTimeout(roomDebounceTimers.get(roomId));
        roomDebounceTimers.delete(roomId);
      }
      
      // Save room to ensure code is persisted before creating version
      await room.save();

      const version = await Version.create({
        room: roomId,
        author: userId,
        code: codeToSave,
        label: label || null,
      });

      emitToRoom(io, roomId, 'version:saved', {
        versionId: version._id,
        label: version.label,
        timestamp: version.createdAt,
      });

      safeCallback(callback, socketResponse(true));
    } catch (err) {
      console.error('version:save error:', err);
      safeCallback(
        callback,
        socketResponse(false, ERROR_CODES.INTERNAL_SERVER_ERROR, 'Save failed')
      );
    }
  });

  socket.on('version:restore', async (data, callback) => {
    try {
      const { roomId, versionId } = data;
      const userId = socket.userId.toString();

      // Validate versionId format
      if (!versionId || typeof versionId !== 'string' || versionId.length !== 24) {
        return callback(
          socketResponse(false, ERROR_CODES.VALIDATION_ERROR, 'Invalid version ID')
        );
      }

      const room = await Room.findById(roomId);
      const version = await Version.findById(versionId);

      if (!room || !version) {
        return callback(
          socketResponse(false, ERROR_CODES.NOT_FOUND, 'Version not found')
        );
      }

      const role = getUserRoleInRoom(room, userId);
      if (![USER_ROLES.OWNER, USER_ROLES.EDITOR].includes(role)) {
        return callback(
          socketResponse(
            false,
            ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            'Cannot restore'
          )
        );
      }

      room.code = version.code;
      room.lastModified = new Date();
      await room.save();

      emitToRoom(io, roomId, 'code:restored', {
        code: room.code,
        versionId,
      });

      callback(socketResponse(true));
    } catch (err) {
      console.error('version:restore error:', err);
      safeCallback(
        callback,
        socketResponse(false, ERROR_CODES.INTERNAL_SERVER_ERROR, 'Restore failed')
      );
    }
  });

  socket.on('version:delete', async (data, callback) => {
    try {
      const { roomId, versionId } = data;
      const userId = socket.userId.toString();

      // Validate versionId format
      if (!versionId || typeof versionId !== 'string' || versionId.length !== 24) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.VALIDATION_ERROR, 'Invalid version ID')
        );
      }

      const room = await Room.findById(roomId);
      const version = await Version.findById(versionId);

      if (!room || !version) {
        return safeCallback(
          callback,
          socketResponse(false, ERROR_CODES.NOT_FOUND, 'Version not found')
        );
      }

      const role = getUserRoleInRoom(room, userId);
      if (![USER_ROLES.OWNER, USER_ROLES.EDITOR].includes(role)) {
        return safeCallback(
          callback,
          socketResponse(
            false,
            ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            'Cannot delete'
          )
        );
      }

      // Delete the version
      await Version.findByIdAndDelete(versionId);

      console.log('Version deleted:', versionId);

      emitToRoom(io, roomId, 'version:deleted', {
        versionId,
      });

      safeCallback(callback, socketResponse(true));
    } catch (err) {
      console.error('version:delete error:', err);
      safeCallback(
        callback,
        socketResponse(false, ERROR_CODES.INTERNAL_SERVER_ERROR, 'Delete failed')
      );
    }
  });

  /* ===== DISCONNECT ===== */

  socket.on('disconnect', async () => {
    try {
      if (socket.currentRoom) {
        emitToRoom(io, socket.currentRoom, 'user:disconnected', {
          userId: socket.user.id,
          username: socket.user.username,
        });
      }

      socketUserMap.delete(socket.id);
    } catch (err) {
      console.error('disconnect error:', err);
    }
  });
};
