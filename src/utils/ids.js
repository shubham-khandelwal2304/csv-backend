const { nanoid } = require('nanoid');

/**
 * Generate a unique job ID
 * @returns {string} A URL-safe unique identifier
 */
function generateJobId() {
  return nanoid(12); // 12 characters for brevity while maintaining uniqueness
}

/**
 * Validate job ID format
 * @param {string} jobId - The job ID to validate
 * @returns {boolean} True if valid
 */
function isValidJobId(jobId) {
  return typeof jobId === 'string' && /^[A-Za-z0-9_-]{12}$/.test(jobId);
}

module.exports = {
  generateJobId,
  isValidJobId
};
