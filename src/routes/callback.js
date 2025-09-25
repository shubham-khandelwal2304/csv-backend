const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isValidJobId } = require('../utils/ids');
const jobStore = require('../services/jobStore');
const mongoClient = require('../services/mongoClient');
const { asyncHandler, createError } = require('../middleware/errors');

const router = express.Router();

// Configure multer for CSV file uploads from n8n
const upload = multer({
  dest: path.join(__dirname, '../../tmp'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for CSV files
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV files and text files (n8n might send as text/plain)
    const allowedTypes = ['text/csv', 'text/plain', 'application/csv'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.warn(`⚠️  Unexpected file type from n8n: ${file.mimetype}`);
      // Still accept it - n8n might send with different MIME type
    }
    cb(null, true);
  }
});

/**
 * POST /api/n8n/callback - Receive CSV from n8n workflow
 */
router.post('/callback', upload.single('csv'), asyncHandler(async (req, res) => {
  const callbackSecret = req.headers['x-callback-secret'];
  const jobId = req.headers['x-job-id'];

  console.log(`📞 n8n callback received for job: ${jobId}`);

  // Validate callback secret
  if (!callbackSecret || callbackSecret !== process.env.CALLBACK_SECRET) {
    console.warn(`🚨 Invalid callback secret for job: ${jobId}`);
    throw createError('Invalid callback secret', 401, 'INVALID_SECRET');
  }

  // Validate job ID
  if (!jobId || !isValidJobId(jobId)) {
    throw createError('Invalid or missing job ID in headers', 400, 'INVALID_JOB_ID');
  }

  // Check if job exists
  const job = jobStore.getJob(jobId);
  if (!job) {
    console.warn(`⚠️  Callback for unknown job: ${jobId}`);
    throw createError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  // Check if CSV file was uploaded
  if (!req.file) {
    console.error(`❌ No CSV file in callback for job: ${jobId}`);
    jobStore.failJob(jobId, 'No CSV file received from n8n');
    throw createError('No CSV file uploaded', 400, 'NO_CSV_FILE');
  }

  const { path: csvPath, size, originalname } = req.file;
  console.log(`📊 Received CSV: ${originalname || 'converted.csv'} (${(size / 1024).toFixed(2)}KB) for job: ${jobId}`);

  try {
    // Read CSV file
    const csvData = fs.readFileSync(csvPath);
    
    // Generate filename for MongoDB storage
    const filename = originalname || `${job.filenamePdf.replace('.pdf', '.csv')}`;
    
    // Store CSV in MongoDB
    const fileId = await mongoClient.storeCSV(jobId, csvData, filename);

    // Generate download URL
    const downloadUrl = await mongoClient.generateDownloadUrl(jobId);

    // Mark job as completed with MongoDB details
    const completedJob = jobStore.completeJob(jobId, fileId, downloadUrl);

    // Clean up temporary file
    try {
      fs.unlinkSync(csvPath);
    } catch (cleanupError) {
      console.warn(`⚠️  Failed to cleanup temp CSV file: ${cleanupError.message}`);
    }

    console.log(`✅ Job completed: ${jobId} - CSV stored in MongoDB: ${fileId}`);
    
    // Log execution completion if available
    if (completedJob && completedJob.executionId) {
      console.log(`🎯 n8n execution ${completedJob.executionId} completed successfully for job ${jobId}`);
    }

    res.json({
      ok: true,
      jobId,
      message: 'CSV processed and stored successfully',
      fileId,
      downloadUrl,
      status: 'completed',
      execution: completedJob && completedJob.executionId ? {
        id: completedJob.executionId,
        status: 'completed',
        message: 'Workflow execution completed successfully'
      } : undefined
    });

  } catch (error) {
    // Clean up temporary file on error
    try {
      fs.unlinkSync(csvPath);
    } catch (cleanupError) {
      console.warn(`⚠️  Failed to cleanup temp CSV file after error: ${cleanupError.message}`);
    }

    // Mark job as failed
    jobStore.failJob(jobId, `CSV processing failed: ${error.message}`);
    
    console.error(`❌ Failed to process CSV for job ${jobId}: ${error.message}`);
    throw error;
  }
}));

/**
 * POST /api/n8n/error - Receive error notifications from n8n (optional)
 */
router.post('/error', asyncHandler(async (req, res) => {
  const callbackSecret = req.headers['x-callback-secret'];
  const jobId = req.headers['x-job-id'];
  const { error, details } = req.body;

  console.log(`🚨 n8n error callback for job: ${jobId}`);

  // Validate callback secret
  if (!callbackSecret || callbackSecret !== process.env.CALLBACK_SECRET) {
    console.warn(`🚨 Invalid callback secret for error callback: ${jobId}`);
    throw createError('Invalid callback secret', 401, 'INVALID_SECRET');
  }

  // Validate job ID
  if (!jobId || !isValidJobId(jobId)) {
    throw createError('Invalid or missing job ID in headers', 400, 'INVALID_JOB_ID');
  }

  // Check if job exists
  const job = jobStore.getJob(jobId);
  if (!job) {
    console.warn(`⚠️  Error callback for unknown job: ${jobId}`);
    // Still return success to avoid n8n retries
    return res.json({ ok: true, message: 'Job not found, but error acknowledged' });
  }

  // Mark job as failed with error details
  const errorMessage = error || 'n8n workflow failed';
  const fullError = details ? `${errorMessage}: ${JSON.stringify(details)}` : errorMessage;
  
  jobStore.failJob(jobId, fullError);

  console.error(`❌ n8n reported error for job ${jobId}: ${fullError}`);

  res.json({
    ok: true,
    jobId,
    message: 'Error acknowledged and job marked as failed'
  });
}));

/**
 * GET /api/n8n/health - Health check endpoint for n8n
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'pdf2csv-callback',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
