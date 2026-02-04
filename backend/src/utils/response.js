// Standard response contract for all API endpoints
export const sendSuccess = (res, statusCode, data, message = 'Success') => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res, statusCode, message, errorCode = 'GENERAL_ERROR') => {
  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    data: null,
  });
};

// Standard socket response contract
export const socketResponse = (success, errorCode = null, message = null) => {
  return {
    success,
    errorCode,
    message,
  };
};
