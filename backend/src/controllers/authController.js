import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ERROR_CODES } from '../utils/constants.js';

// @route POST /api/auth/register
// @access Public
export const register = async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return sendError(res, 400, 'Please provide all required fields', ERROR_CODES.VALIDATION_ERROR);
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return sendError(res, 400, 'User already exists', ERROR_CODES.USER_EXISTS);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      displayName: displayName || username,
    });

    // Generate token
    const token = generateToken(user._id);

    // Return success
    sendSuccess(res, 201, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      },
      token,
    }, 'User registered successfully');
  } catch (error) {
    console.error('Register error:', error);
    sendError(res, 500, 'Error registering user', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route POST /api/auth/login
// @access Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return sendError(res, 400, 'Please provide email and password', ERROR_CODES.VALIDATION_ERROR);
    }

    // Get user with password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return sendError(res, 401, 'Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
    }

    // Compare password
    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return sendError(res, 401, 'Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
    }

    // Generate token
    const token = generateToken(user._id);

    // Return success
    sendSuccess(res, 200, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      },
      token,
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 500, 'Error logging in', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};

// @route GET /api/auth/me
// @access Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    sendSuccess(res, 200, {
      id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
    }, 'User retrieved successfully');
  } catch (error) {
    console.error('GetMe error:', error);
    sendError(res, 500, 'Error retrieving user', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
};
