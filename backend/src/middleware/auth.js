import { verifyToken } from '../utils/jwt.js';
import { sendError } from '../utils/response.js';
import { ERROR_CODES } from '../utils/constants.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 401, 'Not authorized to access this route', ERROR_CODES.UNAUTHORIZED);
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return sendError(res, 401, 'Token is invalid or expired', ERROR_CODES.TOKEN_EXPIRED);
    }

    // Get user from token
    const user = await User.findById(decoded.userId);

    if (!user) {
      return sendError(res, 404, 'User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    sendError(res, 401, 'Not authorized to access this route', ERROR_CODES.UNAUTHORIZED);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};
