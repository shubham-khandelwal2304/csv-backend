const rateLimit = require('express-rate-limit');

/**
 * Helper function to get environment variable with default
 */
function getEnvVar(name, defaultValue, parser = (v) => v) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return parser(value);
}

/**
 * Upload limiter - POST /api/jobs
 * Default: 10/hour per IP
 * Configurable via: RL_UPLOAD_MAX
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getEnvVar('RL_UPLOAD_MAX', '10', parseInt) || 10,
  message: {
    error: 'Too many file uploads. Please try again later.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + '-upload';
  }
});

/**
 * Status check limiter - GET /api/jobs/:jobId/status
 * Default: 30/10s per IP
 * Configurable via: RL_STATUS_MAX
 */
const statusLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: getEnvVar('RL_STATUS_MAX', '30', parseInt) || 30,
  message: {
    error: 'Too many status check requests. Please slow down.',
    code: 'STATUS_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + '-status';
  }
});

/**
 * Download limiter - GET /api/files/download/:fileId
 * Default: 60/min per IP
 * Configurable via: RL_DOWNLOAD_MAX
 */
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: getEnvVar('RL_DOWNLOAD_MAX', '60', parseInt) || 60,
  message: {
    error: 'Too many download requests. Please try again later.',
    code: 'DOWNLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + '-download';
  }
});

/**
 * File list limiter - GET /api/files
 * Default: 120/min per IP
 * Configurable via: RL_LIST_MAX
 */
const listLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: getEnvVar('RL_LIST_MAX', '120', parseInt) || 120,
  message: {
    error: 'Too many list requests. Please slow down.',
    code: 'LIST_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + '-list';
  }
});

/**
 * Delete limiter - DELETE /api/files/:fileId
 * Default: 20/hour per IP
 * Configurable via: RL_DELETE_MAX
 */
const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getEnvVar('RL_DELETE_MAX', '20', parseInt) || 20,
  message: {
    error: 'Too many delete requests. Please try again later.',
    code: 'DELETE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + '-delete';
  }
});

/**
 * Callback limiter for n8n webhooks - POST /api/n8n/*
 * Default: 100/min per IP (skipped if CALLBACK_SECRET is valid)
 */
const callbackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Too many callback requests. Please slow down.',
    code: 'CALLBACK_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + '-callback';
  },
  skip: (req) => {
    const callbackSecret = req.headers['x-callback-secret'];
    return callbackSecret === process.env.CALLBACK_SECRET;
  }
});

module.exports = {
  uploadLimiter,
  statusLimiter,
  downloadLimiter,
  listLimiter,
  deleteLimiter,
  callbackLimiter
};

