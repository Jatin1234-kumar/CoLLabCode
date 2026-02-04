import axios from 'axios';
import Room from '../models/Room.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ERROR_CODES } from '../utils/constants.js';

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

    // Check if Judge0 is configured
    const judge0Url = process.env.JUDGE0_API_URL;
    const judge0ApiKey = process.env.JUDGE0_API_KEY;

    if (!judge0Url || !judge0ApiKey) {
      return sendError(
        res,
        503,
        'Code execution service not configured. Set JUDGE0_API_URL and JUDGE0_API_KEY environment variables.',
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }

    // Map language to Judge0 language ID
    const languageMap = {
      javascript: 63,
      python: 71,
      java: 62,
      cpp: 53,
      c: 50,
      csharp: 51,
      html: 60,
      css: 64,
      sql: 82,
      php: 68,
      ruby: 72,
      go: 60,
      rust: 73,
    };

    const languageId = languageMap[language];
    if (!languageId) {
      return sendError(res, 400, `Language '${language}' is not supported for code execution`, ERROR_CODES.VALIDATION_ERROR);
    }

    try {
      // Submit code to Judge0
      const submitResponse = await axios.post(
        `${judge0Url}/submissions`,
        {
          source_code: code,
          language_id: languageId,
          stdin: '',
        },
        {
          headers: {
            'X-Auth-Token': judge0ApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const submissionToken = submitResponse.data.token;

      // Poll for result (max 10 attempts, 1 second each)
      let result = null;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const resultResponse = await axios.get(`${judge0Url}/submissions/${submissionToken}`, {
          headers: {
            'X-Auth-Token': judge0ApiKey,
          },
        });

        if (resultResponse.data.status.id <= 2) {
          // Still running (1 = In Queue, 2 = Processing)
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          result = resultResponse.data;
          break;
        }
      }

      if (!result) {
        return sendError(res, 504, 'Code execution timeout', ERROR_CODES.INTERNAL_SERVER_ERROR);
      }

      // Format response
      const executionResult = {
        statusId: result.status.id,
        statusName: result.status.description,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        compilationError: result.compile_output || '',
        exitCode: result.exit_code || null,
      };

      sendSuccess(res, 200, executionResult, 'Code executed successfully');
    } catch (judge0Error) {
      console.error('Judge0 API error:', judge0Error.message);
      return sendError(
        res,
        502,
        'Failed to connect to code execution service',
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }
  } catch (error) {
    console.error('RunCode error:', error);
    sendError(res, 500, 'Error executing code', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};
