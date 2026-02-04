// User Roles
export const USER_ROLES = {
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
};

// Request Status
export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

// Programming Languages
export const PROGRAMMING_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'sql',
  'html',
  'css',
];

// Error Codes
export const ERROR_CODES = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_EXISTS: 'USER_EXISTS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Rooms
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_NOT_OWNER: 'ROOM_NOT_OWNER',
  ROOM_FULL: 'ROOM_FULL',
  ALREADY_IN_ROOM: 'ALREADY_IN_ROOM',

  // Access Control
  ACCESS_DENIED: 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  PENDING_APPROVAL: 'PENDING_APPROVAL',

  // Join Requests
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
  REQUEST_ALREADY_EXISTS: 'REQUEST_ALREADY_EXISTS',

  // Versions
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',

  // Socket/Real-time
  SOCKET_UNAUTHORIZED: 'SOCKET_UNAUTHORIZED',
  STALE_UPDATE: 'STALE_UPDATE',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
};
