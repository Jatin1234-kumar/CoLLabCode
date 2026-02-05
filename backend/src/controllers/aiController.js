import Room from '../models/Room.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ERROR_CODES, USER_ROLES } from '../utils/constants.js';

// Models to try in order (from most likely to work with free tier)
const MODELS_TO_TRY = [
  'gemini-1.5-flash',
  'gemini-1.5-pro', 
  'gemini-pro',
  'text-bison-001',
];

// Function to test API key and list available models
export const testGeminiApiKey = async (apiKey) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to list models'
      };
    }
    
    const data = await response.json();
    const models = data.models || [];
    return {
      success: true,
      models: models.map(m => ({
        name: m.name,
        displayName: m.displayName,
        supportedMethods: m.supportedGenerationMethods || []
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Try to find a working model
async function findWorkingModel(apiKey) {
  const result = await testGeminiApiKey(apiKey);
  
  if (!result.success) {
    return null;
  }
  
  // Find first model that supports generateContent
  const model = result.models.find(m => 
    m.supportedMethods && m.supportedMethods.includes('generateContent')
  );
  
  return model ? model.name : null;
}

const getGeminiApiUrl = (modelName) => {
  // Extract just the model name without "models/" prefix if included
  const cleanName = modelName.replace('models/', '');
  return `https://generativelanguage.googleapis.com/v1/models/${cleanName}:generateContent`;
};

const getUserRole = (room, userId) => {
  const participant = room.participants.find((p) => p.userId.toString() === userId.toString());
  return participant ? participant.role : null;
};

const buildPrompt = (message, code) => {
  const safeCode = code || '';
  return [
    'You are a helpful code review assistant.',
    'Provide actionable suggestions, explain risks, and suggest improvements.',
    'If asked a general question, answer it, but also reference the code when relevant.',
    '',
    'User message:',
    message,
    '',
    'Code to review:',
    safeCode,
  ].join('\n');
};

export const reviewCodeWithAI = async (req, res) => {
  try {
    const { message, code } = req.body;
    const roomId = req.params.id;

    if (!message) {
      return sendError(res, 400, 'Message is required', ERROR_CODES.VALIDATION_ERROR);
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return sendError(res, 404, 'Room not found', ERROR_CODES.ROOM_NOT_FOUND);
    }

    const role = getUserRole(room, req.user._id);
    if (![USER_ROLES.OWNER, USER_ROLES.EDITOR].includes(role)) {
      return sendError(res, 403, 'Not authorized to use AI review', ERROR_CODES.ACCESS_DENIED);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return sendError(res, 500, 'Gemini API key not configured', ERROR_CODES.INTERNAL_SERVER_ERROR);
    }

    const prompt = buildPrompt(message, code);

    // Try to find a working model
    let modelName = await findWorkingModel(apiKey);
    
    if (!modelName) {
      console.error('No working Gemini models found with this API key');
      return sendError(
        res, 
        502, 
        'No compatible Gemini models found. Please check: 1) API key is valid, 2) Generative Language API is enabled in Google Cloud Console, 3) Free tier quota not exceeded. Visit https://aistudio.google.com to test your key.',
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }

    const GEMINI_API_URL = getGeminiApiUrl(modelName);
    console.log(`Using Gemini model: ${modelName}`);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', JSON.stringify(errorData, null, 2));
      
      if (response.status === 404) {
        return sendError(res, 502, `Model ${modelName} not found. Check Google AI Studio for available models.`, ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      if (response.status === 429) {
        return sendError(res, 429, 'Free tier API rate limited - try again later', ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      if (response.status === 403) {
        return sendError(res, 502, 'API key invalid, expired, or missing Gemini API enablement', ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      if (response.status === 400) {
        return sendError(res, 502, `Bad request: ${errorData.error?.message}`, ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      
      return sendError(res, 502, `Gemini API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      console.error('Unexpected Gemini response:', data);
      return sendError(res, 502, 'Invalid response from Gemini API', ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
    
    const reply = data.candidates[0].content?.parts?.[0]?.text || 'No response from AI.';

    sendSuccess(res, 200, { reply }, 'AI review completed');
  } catch (error) {
    console.error('AI review error:', error);
    sendError(res, 500, 'AI review failed', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};
