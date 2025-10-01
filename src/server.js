const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jobsRouter = require('./routes/jobs');
const callbackRouter = require('./routes/callback');
const filesRouter = require('./routes/files');
const { errorHandler } = require('./middleware/errors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ,
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/jobs', jobsRouter);
app.use('/api/n8n', callbackRouter);
app.use('/api/files', filesRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PDF2CSV Backend running on port ${PORT}`);
  console.log(`📡 CORS enabled for: ${process.env.ALLOWED_ORIGIN }`);
  console.log(`🔗 n8n webhook: ${process.env.N8N_WEBHOOK_URL || 'NOT_CONFIGURED'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
