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
import { reviewCodeWithAI, testGeminiApiKey } from '../controllers/aiController.js';

const router = express.Router();

// Room routes
router.post('/', protect, createRoom);
router.get('/', protect, getAllRooms);
router.get('/:id', protect, getRoom);
router.delete('/:id', protect, deleteRoom);
router.get('/:id/versions', protect, getRoomVersions);
router.post('/:id/leave', protect, leaveRoom);
router.post('/:id/run', protect, runCode);
router.post('/:id/ai-review', protect, reviewCodeWithAI);

// Join request routes
router.post('/:id/join-request', protect, requestJoinRoom);
router.post('/:id/join-request/:requestId/approve', protect, approveJoinRequest);
router.post('/:id/join-request/:requestId/reject', protect, rejectJoinRequest);

// Participant management routes
router.patch('/:id/participants/:userId/role', protect, updateParticipantRole);
router.post('/:id/transfer-ownership', protect, transferOwnership);

// Debug endpoint to test Gemini API key (shows available models)
router.get('/test/gemini-api', protect, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY not configured in .env' });
    }
    
    const result = await testGeminiApiKey(apiKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
