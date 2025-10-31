const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();


/**
 * n8n client for forwarding PDFs and images to the webhook
 */
class N8nClient {
  constructor() {
    this.webhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (!this.webhookUrl) {
      console.warn('⚠️  N8N_WEBHOOK_URL not configured - PDF forwarding will fail');
    }
  }

  /**
   * Forward PDF or image file to n8n webhook with job ID
   * @param {object} params
   * @param {string} params.filePath - Path to the file
   * @param {string} params.originalName - Original filename
   * @param {string} params.jobId - Job ID for tracking
   * @param {string} params.mimetype - File MIME type
   * @returns {Promise<object>} Response from n8n
   */
  async forwardToN8n({ filePath, originalName, jobId, mimetype }) {
    // Refresh webhook URL in case it was loaded after constructor
    this.webhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (!this.webhookUrl) {
      throw new Error('N8N_WEBHOOK_URL not configured');
    }

    try {
      // Create form data with file and job ID
      const formData = new FormData();
      
      // Determine content type and CSV filename
      const contentType = mimetype || 'application/pdf';
      const fileExtension = path.extname(originalName).toLowerCase();
      const csvFileName = originalName.replace(/\.(pdf|jpg|jpeg|png|gif|webp|tiff|tif|bmp)$/i, '.csv');
      
      // Add the file (PDF or image)
      const fileStream = fs.createReadStream(filePath);
      formData.append('file', fileStream, {
        filename: originalName,
        contentType: contentType
      });
      
      // Add job ID as form field
      formData.append('jobId', jobId);
      
      // Add original filename as form field for n8n workflow
      formData.append('originalName', originalName);
      formData.append('originalFilename', originalName);
      formData.append('fileName', originalName);
      formData.append('csvFileName', csvFileName);
      formData.append('fileType', mimetype);

      const fileType = mimetype.startsWith('image/') ? 'image' : 'PDF';
      console.log(`📤 Forwarding ${fileType} to n8n: ${originalName} (Job: ${jobId})`);

      // Send to n8n webhook
      const response = await axios.post(this.webhookUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'User-Agent': 'pdf2csv-backend/1.0.0'
        },
        timeout: 30000, // 30 second timeout
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        maxBodyLength: 50 * 1024 * 1024
      });

      const fileType = mimetype.startsWith('image/') ? 'image' : 'PDF';
      console.log(`✅ n8n accepted ${fileType}: ${originalName} (Status: ${response.status})`);
      
      // Handle immediate response with execution details
      const responseData = response.data;
      if (Array.isArray(responseData) && responseData.length > 0) {
        const executionInfo = responseData[0];
        console.log(`📊 n8n execution started: ${executionInfo.executionId} (Status: ${executionInfo.status})`);
        
        return {
          success: true,
          status: response.status,
          data: responseData,
          executionId: executionInfo.executionId,
          executionStatus: executionInfo.status,
          message: executionInfo.message,
          webhookUrl: executionInfo.webhookUrl,
          executionMode: executionInfo.executionMode
        };
      }
      
      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      console.error(`❌ Failed to forward PDF to n8n: ${error.message}`);
      
      // Extract meaningful error info
      const errorInfo = {
        success: false,
        error: error.message,
        code: error.code
      };

      if (error.response) {
        errorInfo.status = error.response.status;
        errorInfo.statusText = error.response.statusText;
        errorInfo.data = error.response.data;
      }

      throw new Error(`n8n forwarding failed: ${error.message}`);
    }
  }

  /**
   * Health check for n8n webhook
   * @returns {Promise<boolean>} True if webhook is reachable
   */
  async healthCheck() {
    if (!this.webhookUrl) {
      return false;
    }

    try {
      // Try a HEAD request first (less intrusive)
      const response = await axios.head(this.webhookUrl, { timeout: 5000 });
      return response.status < 400;
    } catch (error) {
      console.warn(`⚠️  n8n webhook health check failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = new N8nClient();
