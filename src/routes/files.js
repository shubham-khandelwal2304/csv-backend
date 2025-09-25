const express = require('express');
const mongoClient = require('../services/mongoClient');
const { asyncHandler, createError } = require('../middleware/errors');

const router = express.Router();

/**
 * GET /api/files/download/:fileId - Download CSV file from MongoDB
 */
router.get('/download/:fileId', asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  
  if (!fileId) {
    throw createError('File ID is required', 400, 'MISSING_FILE_ID');
  }

  try {
    // Get file stream from MongoDB
    const { stream, filename, contentType, size } = await mongoClient.getCSVStream(fileId);
    
    console.log(`📥 Serving MongoDB file download: ${filename} (${(size / 1024).toFixed(2)}KB)`);

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Handle stream errors
    stream.on('error', (error) => {
      console.error(`❌ MongoDB stream error: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'File read error' });
      }
    });

    // Pipe the MongoDB stream to response
    stream.pipe(res);

  } catch (error) {
    console.error(`❌ Failed to serve file from MongoDB: ${error.message}`);
    if (error.message.includes('not found')) {
      throw createError('File not found', 404, 'FILE_NOT_FOUND');
    }
    throw createError('Failed to serve file', 500, 'FILE_SERVE_ERROR');
  }
}));

/**
 * GET /api/files/stats - Get MongoDB storage statistics (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await mongoClient.getStats();
    res.json({
      storage: stats,
      type: 'mongodb-gridfs'
    });
  }));
}

/**
 * GET /api/files/health - MongoDB health check
 */
router.get('/health', asyncHandler(async (req, res) => {
  const isHealthy = await mongoClient.healthCheck();
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'mongodb-storage',
    timestamp: new Date().toISOString()
  });
}));

module.exports = router;
