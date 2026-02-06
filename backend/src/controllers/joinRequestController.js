import Room from '../models/Room.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ERROR_CODES, REQUEST_STATUS, USER_ROLES } from '../utils/constants.js';
import { emitToUser } from '../utils/socket.js';

// @route POST /api/rooms/:id/join-request
// @access Private
export const requestJoinRoom = async (req, res) => {
  try {
    const { requestedRole } = req.body;
    const room = await Room.findById(req.params.id);

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    // Check if user is already a participant
    const existingParticipant = room.participants.find(
      (p) => p.userId.toString() === req.user._id.toString()
    );

    if (existingParticipant) {
      return sendError(res, 400, 'User is already in this room', ERROR_CODES.ALREADY_IN_ROOM);
    }

    // Check if request already exists
    const existingRequest = room.joinRequests.find(
      (r) => r.userId.toString() === req.user._id.toString() && r.status === REQUEST_STATUS.PENDING
    );

    if (existingRequest) {
      return sendError(res, 400, 'Join request already exists', ERROR_CODES.REQUEST_ALREADY_EXISTS);
    }

    // Validate role
    if (!requestedRole || ![USER_ROLES.EDITOR, USER_ROLES.VIEWER].includes(requestedRole)) {
      return sendError(res, 400, 'Invalid requested role', ERROR_CODES.VALIDATION_ERROR);
    }

    // Add join request
    room.joinRequests.push({
      userId: req.user._id,
      requestedRole,
      status: REQUEST_STATUS.PENDING,
    });

    await room.save();
    await room.populate('joinRequests.userId', 'username email displayName');

    const newRequest = room.joinRequests[room.joinRequests.length - 1];

    // Emit socket event to room owner
    emitToUser(room.owner.toString(), 'join:request', {
      roomId: room._id,
      request: newRequest,
    });

    sendSuccess(res, 201, newRequest, 'Join request sent');
  } catch (error) {
    console.error('RequestJoinRoom error:', error);
    sendError(res, 500, 'Error sending join request', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route POST /api/rooms/:id/join-request/:requestId/approve
// @access Private (Owner only)
export const approveJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { overrideRole } = req.body;
    const room = await Room.findById(req.params.id);

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    // Check if user is owner
    if (room.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized', ERROR_CODES.ACCESS_DENIED);
    }

    // Find join request
    const request = room.joinRequests.find((r) => r._id.toString() === requestId);

    if (!request) {
      return sendError(res, 404, 'Join request not found', ERROR_CODES.REQUEST_NOT_FOUND);
    }

    if (request.status !== REQUEST_STATUS.PENDING) {
      return sendError(res, 400, 'Request is not pending', ERROR_CODES.VALIDATION_ERROR);
    }

    // Validate override role if provided
    if (overrideRole && ![USER_ROLES.EDITOR, USER_ROLES.VIEWER].includes(overrideRole)) {
      return sendError(res, 400, 'Invalid override role', ERROR_CODES.VALIDATION_ERROR);
    }

    // Use override role if provided, otherwise use requested role
    const finalRole = overrideRole || request.requestedRole;

    // Add user as participant
    room.participants.push({
      userId: request.userId,
      role: finalRole,
    });

    // Update request status
    request.status = REQUEST_STATUS.APPROVED;

    await room.save();
    await room.populate('participants.userId', 'username email displayName');

    // Emit socket event to the requester
    emitToUser(request.userId.toString(), 'join:approved', {
      roomId: room._id,
      roomName: room.name,
    });

    sendSuccess(res, 200, room, 'Join request approved');
  } catch (error) {
    console.error('ApproveJoinRequest error:', error);
    sendError(res, 500, 'Error approving request', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route POST /api/rooms/:id/join-request/:requestId/reject
// @access Private (Owner only)
export const rejectJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const room = await Room.findById(req.params.id);

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    // Check if user is owner
    if (room.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized', ERROR_CODES.ACCESS_DENIED);
    }

    // Find and remove join request
    const requestIndex = room.joinRequests.findIndex((r) => r._id.toString() === requestId);

    if (requestIndex === -1) {
      return sendError(res, 404, 'Join request not found', ERROR_CODES.REQUEST_NOT_FOUND);
    }

    room.joinRequests[requestIndex].status = REQUEST_STATUS.REJECTED;

    await room.save();

    sendSuccess(res, 200, null, 'Join request rejected');
  } catch (error) {
    console.error('RejectJoinRequest error:', error);
    sendError(res, 500, 'Error rejecting request', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route PATCH /api/rooms/:id/participants/:userId/role
// @access Private (Owner only)
export const updateParticipantRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;
    const room = await Room.findById(req.params.id);

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    // Check if user is owner
    if (room.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized', ERROR_CODES.ACCESS_DENIED);
    }

    // Find participant
    const participant = room.participants.find((p) => p.userId.toString() === userId);

    if (!participant) {
      return sendError(res, 404, 'Participant not found', ERROR_CODES.VALIDATION_ERROR);
    }

    // Don't allow changing owner role
    if (participant.role === USER_ROLES.OWNER) {
      return sendError(res, 403, 'Cannot change owner role', ERROR_CODES.ACCESS_DENIED);
    }

    // Validate new role
    if (!newRole || ![USER_ROLES.EDITOR, USER_ROLES.VIEWER].includes(newRole)) {
      return sendError(res, 400, 'Invalid new role', ERROR_CODES.VALIDATION_ERROR);
    }

    participant.role = newRole;
    await room.save();
    await room.populate('participants.userId', 'username email displayName');

    sendSuccess(res, 200, room, 'Participant role updated');
  } catch (error) {
    console.error('UpdateParticipantRole error:', error);
    sendError(res, 500, 'Error updating role', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route POST /api/rooms/:id/transfer-ownership
// @access Private (Owner only)
export const transferOwnership = async (req, res) => {
  try {
    const { newOwnerId } = req.body;
    const room = await Room.findById(req.params.id);

    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    // Check if user is owner
    if (room.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized', ERROR_CODES.ACCESS_DENIED);
    }

    // Check if new owner is a participant
    const newOwnerParticipant = room.participants.find(
      (p) => p.userId.toString() === newOwnerId
    );

    if (!newOwnerParticipant) {
      return sendError(res, 400, 'New owner must be a participant', ERROR_CODES.VALIDATION_ERROR);
    }

    // Update old owner role to editor
    const oldOwner = room.participants.find((p) => p.userId.toString() === room.owner.toString());
    if (oldOwner) {
      oldOwner.role = USER_ROLES.EDITOR;
    }

    // Update new owner role
    newOwnerParticipant.role = USER_ROLES.OWNER;
    room.owner = newOwnerId;

    await room.save();
    await room.populate('participants.userId', 'username email displayName');

    sendSuccess(res, 200, room, 'Ownership transferred successfully');
  } catch (error) {
    console.error('TransferOwnership error:', error);
    sendError(res, 500, 'Error transferring ownership', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};
