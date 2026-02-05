import axios from 'axios';
import Room from '../models/Room.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ERROR_CODES } from '../utils/constants.js';

// Map language names to Piston language IDs
const PISTON_LANGUAGE_MAP = {
  javascript: 'javascript',
  python: 'python3',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  php: 'php',
  ruby: 'ruby',
  go: 'go',
  rust: 'rust',
};

// @route POST /api/rooms/:id/run
// @access Private (Participants only)
export const runCode = async (req, res) => {
  try {
    const { code, language } = req.body;
    const roomId = req.params.id;

    // Validate inputs
    if (!code) {
      return sendError(res, 400, 'Code is required', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!language) {
      return sendError(res, 400, 'Language is required', ERROR_CODES.VALIDATION_ERROR);
    }

    // Check if room exists and user is participant
    const room = await Room.findById(roomId);
    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    const participant = room.participants.find((p) => p.userId.toString() === req.user._id.toString());
    if (!participant) {
      return sendError(res, 403, 'Not authorized to run code', ERROR_CODES.ACCESS_DENIED);
    }

    // Check if Piston is configured
    const pistonUrl = process.env.PISTON_API_URL || 'https://emkc.org/api/v2';

    // Map language to Piston language
    const pistonLanguage = PISTON_LANGUAGE_MAP[language];
    if (!pistonLanguage) {
      return sendError(res, 400, `Language '${language}' is not supported for code execution`, ERROR_CODES.VALIDATION_ERROR);
    }

    try {
      // Execute code via Piston API
      const executeUrl = `${pistonUrl}/piston/execute`;
      console.log('📤 Piston Execute URL:', executeUrl);
      console.log('📤 Piston Language:', pistonLanguage);

      const executionResponse = await axios.post(
        executeUrl,
        {
          language: pistonLanguage,
          version: '*',
          files: [
            {
              name: 'main',
              content: code,
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const result = executionResponse.data;

      // Format response to match expected format
      const executionResult = {
        statusId: result.run?.exit_code === 0 ? 3 : 5, // 3=Accepted, 5=Runtime Error
        statusName: result.run?.exit_code === 0 ? 'Accepted' : 'Runtime Error',
        stdout: result.run?.stdout || '',
        stderr: result.run?.stderr || '',
        compilationError: result.compile?.stderr || '',
        exitCode: result.run?.exit_code || null,
      };

      console.log('✅ Code executed successfully');
      sendSuccess(res, 200, executionResult, 'Code executed successfully');
    } catch (pistonError) {
      const status = pistonError.response?.status;
      const responseData = pistonError.response?.data;
      const config = pistonError.config;

      console.error('❌ Piston API error:', {
        message: pistonError.message,
        status,
        responseData,
        url: config?.url,
        method: config?.method,
      });

      return sendError(
        res,
        502,
        `Failed to execute code${status ? ` (status ${status})` : ''}. ${pistonError.message}`,
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }
  } catch (error) {
    console.error('RunCode error:', error);
    sendError(res, 500, 'Error executing code', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};
