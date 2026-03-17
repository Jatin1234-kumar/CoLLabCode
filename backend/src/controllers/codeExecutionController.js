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

// Map language names to Judge0 language IDs
const JUDGE0_LANGUAGE_MAP = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
  csharp: 51,
  php: 68,
  ruby: 72,
  go: 60,
  rust: 73,
};

const formatPistonResult = (result) => ({
  statusId: result.run?.exit_code === 0 ? 3 : 5,
  statusName: result.run?.exit_code === 0 ? 'Accepted' : 'Runtime Error',
  stdout: result.run?.stdout || '',
  stderr: result.run?.stderr || '',
  compilationError: result.compile?.stderr || '',
  exitCode: result.run?.exit_code || null,
});

const formatJudge0Result = (result) => {
  const statusId = result.status?.id || 0;
  const statusName = result.status?.description || 'Unknown';

  return {
    statusId,
    statusName,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    compilationError: result.compile_output || '',
    exitCode: result.exit_code || null,
  };
};

const executeWithPiston = async (pistonUrl, pistonLanguage, code) => {
  const executeUrl = `${pistonUrl}/piston/execute`;

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

  return formatPistonResult(executionResponse.data);
};

const executeWithJudge0 = async (judge0Url, judge0LanguageId, code) => {
  const normalizedJudge0Url = judge0Url.replace(/\/$/, '');
  const executeUrl = `${normalizedJudge0Url}/submissions?base64_encoded=false&wait=true`;

  const headers = {
    'Content-Type': 'application/json',
  };

  const judge0ApiKey = process.env.JUDGE0_API_KEY;
  if (judge0ApiKey) {
    const judge0Host = process.env.JUDGE0_API_HOST || new URL(normalizedJudge0Url).hostname;
    headers['x-rapidapi-key'] = judge0ApiKey;
    headers['x-rapidapi-host'] = judge0Host;
    headers.Authorization = `Bearer ${judge0ApiKey}`;
    headers['X-Auth-Token'] = judge0ApiKey;
  }

  const executionResponse = await axios.post(
    executeUrl,
    {
      source_code: code,
      language_id: judge0LanguageId,
    },
    {
      headers,
      timeout: 30000,
    }
  );

  return formatJudge0Result(executionResponse.data);
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

    // Check if execution services are configured
    const pistonUrl = process.env.PISTON_API_URL || 'https://emkc.org/api/v2';
    const judge0Url = process.env.JUDGE0_API_URL;

    // Map language to execution service language configs
    const pistonLanguage = PISTON_LANGUAGE_MAP[language];
    const judge0LanguageId = JUDGE0_LANGUAGE_MAP[language];

    if (!pistonLanguage && !judge0LanguageId) {
      return sendError(res, 400, `Language '${language}' is not supported for code execution`, ERROR_CODES.VALIDATION_ERROR);
    }

    let pistonErrorDetails = null;

    try {
      if (pistonLanguage) {
        const executionResult = await executeWithPiston(pistonUrl, pistonLanguage, code);
        return sendSuccess(res, 200, executionResult, 'Code executed successfully');
      }
    } catch (pistonError) {
      const status = pistonError.response?.status;
      const pistonResponseMessage = String(pistonError.response?.data?.message || '');
      pistonErrorDetails = {
        status,
        message: pistonError.message,
        responseMessage: pistonResponseMessage,
      };

      console.error('Piston API error:', pistonError.message, status ? `(status ${status})` : '', pistonResponseMessage || '');
    }

    if (judge0Url && judge0LanguageId) {
      try {
        const executionResult = await executeWithJudge0(judge0Url, judge0LanguageId, code);
        return sendSuccess(res, 200, executionResult, 'Code executed successfully (Judge0 fallback)');
      } catch (judge0Error) {
        const status = judge0Error.response?.status;
        const judge0ResponseMessage =
          String(judge0Error.response?.data?.error || judge0Error.response?.data?.message || '');

        console.error('Judge0 API error:', judge0Error.message, status ? `(status ${status})` : '', judge0ResponseMessage || '');

        return sendError(
          res,
          502,
          `Failed to execute code via fallback service${status ? ` (status ${status})` : ''}. ${judge0Error.message}`,
          ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    }

    if (pistonErrorDetails?.responseMessage?.toLowerCase().includes('whitelist only')) {
      return sendError(
        res,
        503,
        'Code execution is temporarily unavailable. Public Piston access is whitelist-only and Judge0 fallback is not configured.',
        ERROR_CODES.EXECUTION_SERVICE_UNAVAILABLE
      );
    }

    if (!judge0Url) {
      return sendError(
        res,
        503,
        'Code execution failed on Piston and Judge0 fallback is not configured. Set JUDGE0_API_URL to enable fallback.',
        ERROR_CODES.EXECUTION_SERVICE_UNAVAILABLE
      );
    }

    return sendError(
      res,
      502,
      'Failed to execute code via available execution services.',
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  } catch (error) {
    console.error('RunCode error:', error.message);
    sendError(res, 500, 'Error executing code', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};
