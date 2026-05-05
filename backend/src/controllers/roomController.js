import Room from '../models/Room.js';
import Version from '../models/Version.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ERROR_CODES, USER_ROLES, REQUEST_STATUS } from '../utils/constants.js';
import { emitToRoom, emitToUser, broadcastToAll } from '../utils/socket.js';
import { v4 as uuidv4 } from 'uuid';

const generateRoomCode = async () => {
  let code;
  let isUnique = false;
  while (!isUnique) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    const existingRoom = await Room.findOne({ roomCode: code });
    if (!existingRoom) isUnique = true;
  }
  return code;
};

export const createRoom = async (req, res) => {
  try {
    const { name, language } = req.body;
    if (!name) return sendError(res, 400, 'Room name is required', ERROR_CODES.VALIDATION_ERROR);
    const roomCode = await generateRoomCode();
    const room = await Room.create({
      name, roomCode,
      language: language || 'javascript',
      owner: req.user._id,
      participants: [{ userId: req.user._id, role: USER_ROLES.OWNER }],
    });
    await room.populate('owner', 'username email displayName');
    await room.populate('participants.userId', 'username email displayName');
    const roomForBroadcast = room.toObject();
    delete roomForBroadcast.roomCode;
    broadcastToAll('room:created', { room: roomForBroadcast });
    sendSuccess(res, 201, room, 'Room created successfully');
  } catch (error) {
    console.error('CreateRoom error:', error);
    sendError(res, 500, 'Error creating room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('owner', 'username email displayName')
      .populate('participants.userId', 'username email displayName')
      .sort({ updatedAt: -1 });
    const roomsWithFilteredCodes = rooms.map(room => {
      const roomObj = room.toObject();
      if (room.owner._id.toString() !== req.user._id.toString()) delete roomObj.roomCode;
      return roomObj;
    });
    sendSuccess(res, 200, roomsWithFilteredCodes, 'Rooms retrieved successfully');
  } catch (error) {
    console.error('GetAllRooms error:', error);
    sendError(res, 500, 'Error retrieving rooms', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('owner', 'username email displayName')
      .populate('participants.userId', 'username email displayName')
      .populate('joinRequests.userId', 'username email displayName');
    if (!room) return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    const roomObj = room.toObject();
    if (room.owner._id.toString() !== req.user._id.toString()) delete roomObj.roomCode;
    sendSuccess(res, 200, roomObj, 'Room retrieved successfully');
  } catch (error) {
    console.error('GetRoom error:', error);
    sendError(res, 500, 'Error retrieving room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    if (room.owner.toString() !== req.user._id.toString())
      return sendError(res, 403, 'Not authorized to delete this room', ERROR_CODES.ACCESS_DENIED);
    const roomId = room._id.toString();
    emitToRoom(roomId, 'room:deleted', { roomId, roomName: room.name, message: 'This room has been deleted by the owner' });
    broadcastToAll('room:deleted', { roomId, roomName: room.name, message: 'This room has been deleted by the owner' });
    await Version.deleteMany({ room: room._id });
    await Room.findByIdAndDelete(req.params.id);
    sendSuccess(res, 200, null, 'Room deleted successfully');
  } catch (error) {
    console.error('DeleteRoom error:', error);
    sendError(res, 500, 'Error deleting room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const getRoomVersions = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    const participant = room.participants.find(p => p.userId.toString() === req.user._id.toString());
    if (!participant) return sendError(res, 403, 'Not authorized to view versions', ERROR_CODES.ACCESS_DENIED);
    const versions = await Version.find({ room: room._id })
      .populate('author', 'username email displayName')
      .sort({ createdAt: -1 })
      .limit(room.maxVersions);
    sendSuccess(res, 200, versions, 'Versions retrieved successfully');
  } catch (error) {
    console.error('GetRoomVersions error:', error);
    sendError(res, 500, 'Error retrieving versions', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const leaveRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    const participantIndex = room.participants.findIndex(p => p.userId.toString() === req.user._id.toString());
    if (participantIndex === -1) return sendError(res, 400, 'User is not in this room', ERROR_CODES.VALIDATION_ERROR);
    if (room.participants[participantIndex].role === USER_ROLES.OWNER)
      return sendError(res, 403, 'Owner must transfer ownership before leaving', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    await room.populate('participants.userId', 'username email displayName');
    const userInfo = room.participants[participantIndex].userId;
    room.participants.splice(participantIndex, 1);
    await room.save();
    emitToUser(room.owner.toString(), 'participant:left', {
      roomId: room._id, roomName: room.name,
      userId: req.user._id, userName: userInfo.displayName || userInfo.username,
    });
    emitToRoom(room._id.toString(), 'participant:left', { userId: req.user._id });
    sendSuccess(res, 200, null, 'Left room successfully');
  } catch (error) {
    console.error('LeaveRoom error:', error);
    sendError(res, 500, 'Error leaving room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const getRoomByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code || code.length !== 6) return sendError(res, 400, 'Invalid room code', ERROR_CODES.VALIDATION_ERROR);
    const room = await Room.findOne({ roomCode: code })
      .populate('owner', 'username email displayName')
      .populate('participants.userId', 'username email displayName')
      .populate('joinRequests.userId', 'username email displayName');
    if (!room) return sendError(res, 404, 'Room not found with this code', ERROR_CODES.ROOM_NOT_FOUND);
    sendSuccess(res, 200, room, 'Room retrieved successfully');
  } catch (error) {
    console.error('GetRoomByCode error:', error);
    sendError(res, 500, 'Error retrieving room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// ── File System Endpoints ──────────────────────────────────────────────────

const isEditorOrOwner = (room, userId) => {
  const p = room.participants.find(p => p.userId.toString() === userId.toString());
  return p && [USER_ROLES.OWNER, USER_ROLES.EDITOR].includes(p.role);
};

const isParticipantFn = (room, userId) =>
  room.participants.some(p => p.userId.toString() === userId.toString());

export const getRoomFiles = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    if (!isParticipantFn(room, req.user._id))
      return sendError(res, 403, 'Not authorized', ERROR_CODES.ACCESS_DENIED);
    sendSuccess(res, 200, room.files, 'Files retrieved');
  } catch (e) {
    sendError(res, 500, 'Error retrieving files', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const createFile = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    if (!isEditorOrOwner(room, req.user._id))
      return sendError(res, 403, 'Editors and owners only', ERROR_CODES.INSUFFICIENT_PERMISSIONS);

    const { name, path, language, isFolder } = req.body;
    if (!name || !path) return sendError(res, 400, 'name and path required', ERROR_CODES.VALIDATION_ERROR);
    if (room.files.some(f => f.path === path))
      return sendError(res, 400, 'A file at this path already exists', ERROR_CODES.VALIDATION_ERROR);

    const newFile = {
      id: uuidv4(),
      name,
      path,
      content: '',
      language: language || 'javascript',
      isFolder: !!isFolder,
    };

    room.files.push(newFile);
    await room.save();
    emitToRoom(req.params.id, 'file:created', { file: newFile });
    sendSuccess(res, 201, newFile, 'File created');
  } catch (e) {
    console.error('createFile error:', e);
    sendError(res, 500, 'Error creating file', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// PATCH /api/rooms/:id/files/:fileId
// body: { name?, path?, content?, language?, oldPath? }
// When renaming a folder (isFolder=true, oldPath provided), cascades path
// updates to all children whose paths start with oldPath.
export const updateFile = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    if (!isEditorOrOwner(room, req.user._id))
      return sendError(res, 403, 'Editors and owners only', ERROR_CODES.INSUFFICIENT_PERMISSIONS);

    const file = room.files.find(f => f.id === req.params.fileId);
    if (!file) return sendError(res, 404, 'File not found', ERROR_CODES.NOT_FOUND);

    const { name, path, content, language, oldPath } = req.body;

    // Cascade rename to all children when a folder path changes
    if (file.isFolder && path !== undefined && oldPath && path !== oldPath) {
      room.files.forEach(f => {
        if (f.id !== file.id && f.path.startsWith(oldPath + '/')) {
          f.path = path + f.path.slice(oldPath.length);
        }
      });
    }

    if (name !== undefined) file.name = name;
    if (path !== undefined) file.path = path;
    if (content !== undefined) file.content = content;
    if (language !== undefined) file.language = language;

    await room.save();
    // Return full files array so client can sync all cascaded path changes
    emitToRoom(req.params.id, 'files:reloaded', { files: room.files });
    sendSuccess(res, 200, room.files, 'File updated');
  } catch (e) {
    console.error('updateFile error:', e);
    sendError(res, 500, 'Error updating file', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const deleteFile = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    if (!isEditorOrOwner(room, req.user._id))
      return sendError(res, 403, 'Editors and owners only', ERROR_CODES.INSUFFICIENT_PERMISSIONS);

    const fileId = req.params.fileId;
    const file = room.files.find(f => f.id === fileId);
    if (!file) return sendError(res, 404, 'File not found', ERROR_CODES.NOT_FOUND);

    // Delete folder and all its children
    const pathPrefix = file.path + '/';
    room.files = room.files.filter(f => f.id !== fileId && !f.path.startsWith(pathPrefix));
    await room.save();

    emitToRoom(req.params.id, 'file:deleted', { fileId, path: file.path });
    sendSuccess(res, 200, null, 'File deleted');
  } catch (e) {
    console.error('deleteFile error:', e);
    sendError(res, 500, 'Error deleting file', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};
