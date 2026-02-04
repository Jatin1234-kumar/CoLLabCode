import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createRoom,
  getAllRooms,
  getRoom,
  deleteRoom,
  getRoomVersions,
  leaveRoom,
} from '../controllers/roomController.js';
import {
  requestJoinRoom,
  approveJoinRequest,
  rejectJoinRequest,
  updateParticipantRole,
  transferOwnership,
} from '../controllers/joinRequestController.js';
import { runCode } from '../controllers/codeExecutionController.js';

const router = express.Router();

// Room routes
router.post('/', protect, createRoom);
router.get('/', protect, getAllRooms);
router.get('/:id', protect, getRoom);
router.delete('/:id', protect, deleteRoom);
router.get('/:id/versions', protect, getRoomVersions);
router.post('/:id/leave', protect, leaveRoom);
router.post('/:id/run', protect, runCode);

// Join request routes
router.post('/:id/join-request', protect, requestJoinRoom);
router.post('/:id/join-request/:requestId/approve', protect, approveJoinRequest);
router.post('/:id/join-request/:requestId/reject', protect, rejectJoinRequest);

// Participant management routes
router.patch('/:id/participants/:userId/role', protect, updateParticipantRole);
router.post('/:id/transfer-ownership', protect, transferOwnership);

export default router;
