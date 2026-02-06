import Room from '../models/Room.js';
import Version from '../models/Version.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ERROR_CODES, USER_ROLES, REQUEST_STATUS } from '../utils/constants.js';
import { emitToRoom, emitToUser, broadcastToAll } from '../utils/socket.js';

// Helper function to generate unique 6-digit room code
const generateRoomCode = async () => {
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    // Generate random 6-digit code
    code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if code already exists
    const existingRoom = await Room.findOne({ roomCode: code });
    if (!existingRoom) {
      isUnique = true;
    }
  }
  
  return code;
};

// @route POST /api/rooms
// @access Private
export const createRoom = async (req, res) => {
  try {
    const { name, language } = req.body;

    if (!name) {
      return sendError(res, 400, 'Room name is required', ERROR_CODES.VALIDATION_ERROR);
    }

    // Generate unique room code
    const roomCode = await generateRoomCode();

    const room = await Room.create({
      name,
      roomCode,
      language: language || 'javascript',
      owner: req.user._id,
      participants: [{
        userId: req.user._id,
        role: USER_ROLES.OWNER,
      }],
    });

    await room.populate('owner', 'username email displayName');
    await room.populate('participants.userId', 'username email displayName');

    // Broadcast to all connected users that a new room was created (without room code)
    const roomForBroadcast = room.toObject();
    delete roomForBroadcast.roomCode;
    
    broadcastToAll('room:created', {
      room: roomForBroadcast,
    });

    sendSuccess(res, 201, room, 'Room created successfully');
  } catch (error) {
    console.error('CreateRoom error:', error);
    sendError(res, 500, 'Error creating room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route GET /api/rooms
// @access Private
export const getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('owner', 'username email displayName')
      .populate('participants.userId', 'username email displayName')
      .sort({ updatedAt: -1 });

    // Hide room code from non-owners
    const roomsWithFilteredCodes = rooms.map(room => {
      const roomObj = room.toObject();
      const isOwner = room.owner._id.toString() === req.user._id.toString();
      
      if (!isOwner) {
        delete roomObj.roomCode;
      }
      
      return roomObj;
    });

    sendSuccess(res, 200, roomsWithFilteredCodes, 'Rooms retrieved successfully');
  } catch (error) {
    console.error('GetAllRooms error:', error);
    sendError(res, 500, 'Error retrieving rooms', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route GET /api/rooms/:id
// @access Private
export const getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('owner', 'username email displayName')
      .populate('participants.userId', 'username email displayName')
      .populate('joinRequests.userId', 'username email displayName');

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    // Hide room code from non-owners
    const roomObj = room.toObject();
    const isOwner = room.owner._id.toString() === req.user._id.toString();
    
    if (!isOwner) {
      delete roomObj.roomCode;
    }

    sendSuccess(res, 200, roomObj, 'Room retrieved successfully');
  } catch (error) {
    console.error('GetRoom error:', error);
    sendError(res, 500, 'Error retrieving room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route DELETE /api/rooms/:id
// @access Private (Owner only)
export const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    if (room.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized to delete this room', ERROR_CODES.ACCESS_DENIED);
    }

    const roomId = room._id.toString();

    // Notify all participants in the room before deletion
    emitToRoom(roomId, 'room:deleted', {
      roomId: roomId,
      roomName: room.name,
      message: 'This room has been deleted by the owner',
    });

    // Delete associated versions
    await Version.deleteMany({ room: room._id });

    await Room.findByIdAndDelete(req.params.id);

    sendSuccess(res, 200, null, 'Room deleted successfully');
  } catch (error) {
    console.error('DeleteRoom error:', error);
    sendError(res, 500, 'Error deleting room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route GET /api/rooms/:id/versions
// @access Private (Participants only)
export const getRoomVersions = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    // Check if user is participant
    const participant = room.participants.find((p) => p.userId.toString() === req.user._id.toString());
    if (!participant) {
      return sendError(res, 403, 'Not authorized to view versions', ERROR_CODES.ACCESS_DENIED);
    }

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

// @route POST /api/rooms/:id/leave
// @access Private
export const leaveRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    // Check if user is participant
    const participantIndex = room.participants.findIndex(
      (p) => p.userId.toString() === req.user._id.toString()
    );

    if (participantIndex === -1) {
      return sendError(res, 400, 'User is not in this room', ERROR_CODES.VALIDATION_ERROR);
    }

    // Don't allow owner to leave without transferring ownership
    if (room.participants[participantIndex].role === USER_ROLES.OWNER) {
      return sendError(
        res,
        403,
        'Owner must transfer ownership before leaving',
        ERROR_CODES.INSUFFICIENT_PERMISSIONS
      );
    }

    // Store user info before removing
    await room.populate('participants.userId', 'username email displayName');
    const userInfo = room.participants[participantIndex].userId;
    
    room.participants.splice(participantIndex, 1);
    await room.save();

    // Emit to room owner
    console.log('📤 Emitting participant:left to owner:', room.owner.toString());
    emitToUser(room.owner.toString(), 'participant:left', {
      roomId: room._id,
      roomName: room.name,
      userId: req.user._id,
      userName: userInfo.displayName || userInfo.username,
    });

    // Emit to room for real-time participant list update
    emitToRoom(room._id.toString(), 'participant:left', {
      userId: req.user._id,
    });

    sendSuccess(res, 200, null, 'Left room successfully');
  } catch (error) {
    console.error('LeaveRoom error:', error);
    sendError(res, 500, 'Error leaving room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route GET /api/rooms/code/:code
// @access Private
export const getRoomByCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.length !== 6) {
      return sendError(res, 400, 'Invalid room code', ERROR_CODES.VALIDATION_ERROR);
    }

    const room = await Room.findOne({ roomCode: code })
      .populate('owner', 'username email displayName')
      .populate('participants.userId', 'username email displayName')
      .populate('joinRequests.userId', 'username email displayName');

    if (!room) {
      return sendError(res, 404, 'Room not found with this code', ERROR_CODES.ROOM_NOT_FOUND);
    }

    sendSuccess(res, 200, room, 'Room retrieved successfully');
  } catch (error) {
    console.error('GetRoomByCode error:', error);
    sendError(res, 500, 'Error retrieving room', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};
