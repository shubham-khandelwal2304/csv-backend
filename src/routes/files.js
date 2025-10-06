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
 * GET /api/files - List all files from MongoDB
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const startTime = Date.now();
    const stats = await mongoClient.getStats();
    
    // Format files for frontend consumption with optimized processing
    const files = stats.files
      .map(file => ({
        id: file.id,
        filename: file.filename,
        size: file.size,
        uploadDate: file.uploadDate,
        jobId: file.jobId,
        downloadUrl: `/api/files/download/${file.id}`,
        formattedSize: formatFileSize(file.size),
        formattedDate: new Date(file.uploadDate).toLocaleString()
      }))
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)); // Sort by upload date (newest first)

    const processingTime = Date.now() - startTime;
    console.log(`📁 Files API response time: ${processingTime}ms (${files.length} files)`);

    // Set cache headers for better performance
    res.setHeader('Cache-Control', 'private, max-age=60'); // Cache for 1 minute
    res.setHeader('X-Response-Time', `${processingTime}ms`);

    res.json({
      files,
      totalFiles: stats.totalFiles,
      totalSize: stats.totalSize,
      formattedTotalSize: formatFileSize(stats.totalSize),
      responseTime: processingTime
    });
  } catch (error) {
    console.error(`❌ Failed to list files: ${error.message}`);
    throw createError('Failed to retrieve files', 500, 'FILES_LIST_ERROR');
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
 * DELETE /api/files/:fileId - Delete a file from MongoDB
 */
router.delete('/:fileId', asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  
  if (!fileId) {
    throw createError('File ID is required', 400, 'MISSING_FILE_ID');
  }

  try {
    // Find the file first to get metadata
    const stats = await mongoClient.getStats();
    const file = stats.files.find(f => f.id === fileId);
    
    if (!file) {
      throw createError('File not found', 404, 'FILE_NOT_FOUND');
    }

    // Delete from MongoDB using jobId (since deleteCSV uses jobId)
    const deleted = await mongoClient.deleteCSV(file.jobId);
    
    if (!deleted) {
      throw createError('Failed to delete file', 500, 'DELETE_FAILED');
    }

    console.log(`🗑️  File deleted: ${file.filename} (ID: ${fileId})`);

    res.json({
      success: true,
      message: 'File deleted successfully',
      fileId,
      filename: file.filename
    });

  } catch (error) {
    console.error(`❌ Failed to delete file ${fileId}: ${error.message}`);
    if (error.message.includes('not found')) {
      throw createError('File not found', 404, 'FILE_NOT_FOUND');
    }
    throw createError('Failed to delete file', 500, 'DELETE_ERROR');
  }
}));

/**
 * Helper function to format file sizes
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
