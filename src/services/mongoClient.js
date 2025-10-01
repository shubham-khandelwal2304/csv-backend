const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');

/**
 * MongoDB client for storing and retrieving CSV files using GridFS
 */
class MongoClient_CSV {
  constructor() {
    this.client = null;
    this.db = null;
    this.bucket = null;
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      const mongoUrl = process.env.MONGODB_URI ;
      const dbName = process.env.MONGODB_DB_NAME || 'pdf2csv';

      console.log(`🔌 Connecting to MongoDB: ${mongoUrl.replace(/\/\/.*:.*@/, '//***:***@')}`);
      
      // MongoDB connection options for better SSL/TLS handling
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        socketTimeoutMS: 45000, // 45 second socket timeout
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverApi: {
          version: '1',
          strict: true,
          deprecationErrors: true,
        }
      };

      this.client = new MongoClient(mongoUrl, options);
      await this.client.connect();
      
      this.db = this.client.db(dbName);
      this.bucket = new GridFSBucket(this.db, { bucketName: 'csvFiles' });
      
      this.isConnected = true;
      console.log(`✅ Connected to MongoDB database: ${dbName}`);
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  /**
   * Store CSV file in MongoDB GridFS
   * @param {string} jobId - Job identifier
   * @param {Buffer} csvBuffer - CSV file content as buffer
   * @param {string} filename - Original filename
   * @returns {Promise<string>} File ID for retrieval
   */
  async storeCSV(jobId, csvBuffer, filename) {
    await this.connect();

    try {
      const uploadStream = this.bucket.openUploadStream(filename, {
        metadata: {
          jobId,
          uploadDate: new Date(),
          contentType: 'text/csv',
          originalName: filename
        }
      });

      return new Promise((resolve, reject) => {
        uploadStream.on('error', reject);
        uploadStream.on('finish', () => {
          console.log(`📁 CSV stored in MongoDB: ${filename} (Job: ${jobId}, FileId: ${uploadStream.id})`);
          resolve(uploadStream.id.toString());
        });

        uploadStream.end(csvBuffer);
      });
    } catch (error) {
      console.error('❌ Failed to store CSV in MongoDB:', error.message);
      throw new Error(`Failed to store CSV: ${error.message}`);
    }
  }

  /**
   * Generate download URL for CSV file
   * @param {string} jobId - Job identifier
   * @returns {Promise<string>} Download URL
   */
  async generateDownloadUrl(jobId) {
    await this.connect();

    try {
      // Find file by jobId in metadata
      const file = await this.bucket.find({ 'metadata.jobId': jobId }).toArray();
      
      if (!file || file.length === 0) {
        throw new Error(`CSV file not found for job: ${jobId}`);
      }

      const fileId = file[0]._id.toString();
      
      // Return URL that points to our download endpoint
      const baseUrl = process.env.BASE_URL;
      const downloadUrl = `${baseUrl}/api/files/download/${fileId}`;
      
      console.log(`🔗 Generated download URL for job ${jobId}: ${downloadUrl}`);
      return downloadUrl;
    } catch (error) {
      console.error('❌ Failed to generate download URL:', error.message);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Get CSV file stream from MongoDB
   * @param {string} fileId - File ID
   * @returns {Promise<{stream: ReadableStream, filename: string, contentType: string}>}
   */
  async getCSVStream(fileId) {
    await this.connect();

    try {
      const objectId = new ObjectId(fileId);
      
      // Get file metadata
      const file = await this.bucket.find({ _id: objectId }).toArray();
      if (!file || file.length === 0) {
        throw new Error(`File not found: ${fileId}`);
      }

      const fileInfo = file[0];
      const downloadStream = this.bucket.openDownloadStream(objectId);
      
      return {
        stream: downloadStream,
        filename: fileInfo.filename,
        contentType: fileInfo.metadata?.contentType || 'text/csv',
        size: fileInfo.length
      };
    } catch (error) {
      console.error('❌ Failed to get CSV stream:', error.message);
      throw new Error(`Failed to get CSV stream: ${error.message}`);
    }
  }

  /**
   * Delete CSV file from MongoDB
   * @param {string} jobId - Job identifier
   * @returns {Promise<boolean>} Success status
   */
  async deleteCSV(jobId) {
    await this.connect();

    try {
      const file = await this.bucket.find({ 'metadata.jobId': jobId }).toArray();
      
      if (!file || file.length === 0) {
        console.log(`⚠️  No CSV file found to delete for job: ${jobId}`);
        return false;
      }

      await this.bucket.delete(file[0]._id);
      console.log(`🗑️  Deleted CSV file for job: ${jobId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete CSV:', error.message);
      throw new Error(`Failed to delete CSV: ${error.message}`);
    }
  }

  /**
   * Health check for MongoDB connection
   * @returns {Promise<boolean>} Connection status
   */
  async healthCheck() {
    try {
      await this.connect();
      await this.db.admin().ping();
      return true;
    } catch (error) {
      console.error('❌ MongoDB health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get stats about stored files (for development/debugging)
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    await this.connect();

    try {
      const files = await this.bucket.find({}).toArray();
      const totalSize = files.reduce((sum, file) => sum + file.length, 0);
      
      return {
        totalFiles: files.length,
        totalSize,
        files: files.map(file => ({
          id: file._id.toString(),
          filename: file.filename,
          size: file.length,
          uploadDate: file.uploadDate,
          jobId: file.metadata?.jobId
        }))
      };
    } catch (error) {
      console.error('❌ Failed to get MongoDB stats:', error.message);
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }
}

// Create and export singleton instance
const mongoClient = new MongoClient_CSV();

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoClient.disconnect();
  process.exit(0);
});

module.exports = mongoClient;
