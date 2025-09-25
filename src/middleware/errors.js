/**
 * Central error handling middleware
 * Catches all errors and returns consistent JSON responses
 */

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Next middleware
 */
function errorHandler(err, req, res, next) {
  // Don't leak internal paths or sensitive info
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  console.error('🚨 Error:', {
    message: err.message,
    stack: isDevelopment ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Default error response
  let status = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError' || err.message.includes('unauthorized')) {
    status = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError' || err.message.includes('forbidden')) {
    status = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  } else if (err.name === 'NotFoundError' || err.message.includes('not found')) {
    status = 404;
    message = 'Resource not found';
    code = 'NOT_FOUND';
  } else if (err.name === 'MulterError') {
    status = 400;
    code = 'FILE_UPLOAD_ERROR';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large (max 20MB)';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = 'File upload error';
    }
  } else if (err.code === 'ECONNREFUSED') {
    status = 502;
    message = 'External service unavailable';
    code = 'SERVICE_UNAVAILABLE';
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    status = 504;
    message = 'Request timeout';
    code = 'TIMEOUT';
  }

  // Build error response
  const errorResponse = {
    error: {
      message,
      code,
      timestamp: new Date().toISOString()
    }
  };

  // Add additional details in development
  if (isDevelopment) {
    errorResponse.error.details = err.message;
    if (err.stack) {
      errorResponse.error.stack = err.stack.split('\n');
    }
  }

  res.status(status).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 * @param {function} fn - Async route handler
 * @returns {function} Wrapped handler with error catching
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a custom error
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} code - Error code
 * @returns {Error} Custom error
 */
function createError(message, status = 500, code = 'CUSTOM_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

module.exports = {
  errorHandler,
  asyncHandler,
  createError
};
