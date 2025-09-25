const mongoClient = require('../src/services/mongoClient');

// Mock MongoDB to avoid requiring actual database in tests
jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    close: jest.fn(),
    db: jest.fn().mockReturnValue({
      admin: jest.fn().mockReturnValue({
        ping: jest.fn()
      })
    })
  })),
  GridFSBucket: jest.fn().mockImplementation(() => ({
    openUploadStream: jest.fn(),
    openDownloadStream: jest.fn(),
    find: jest.fn().mockReturnValue({
      toArray: jest.fn()
    }),
    delete: jest.fn()
  })),
  ObjectId: jest.fn()
}));

describe('MongoClient', () => {
  beforeEach(() => {
    // Reset environment variables
    process.env.MONGODB_URL = 'mongodb://localhost:27017';
    process.env.MONGODB_DB_NAME = 'test-pdf2csv';
    process.env.BASE_URL = 'http://localhost:8080';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDownloadUrl', () => {
    it('should generate download URL with correct format', async () => {
      // Mock the find method to return a file
      const mockFile = { _id: 'mock-file-id-123' };
      mongoClient.bucket = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([mockFile])
        })
      };
      mongoClient.isConnected = true;

      const jobId = 'test-job-123';
      const downloadUrl = await mongoClient.generateDownloadUrl(jobId);

      expect(downloadUrl).toBe('http://localhost:8080/api/files/download/mock-file-id-123');
    });

    it('should throw error if file not found', async () => {
      mongoClient.bucket = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      };
      mongoClient.isConnected = true;

      const jobId = 'non-existent-job';
      
      await expect(mongoClient.generateDownloadUrl(jobId))
        .rejects
        .toThrow('CSV file not found for job: non-existent-job');
    });
  });

  describe('healthCheck', () => {
    it('should return true when MongoDB is accessible', async () => {
      mongoClient.db = {
        admin: jest.fn().mockReturnValue({
          ping: jest.fn().mockResolvedValue({})
        })
      };
      mongoClient.isConnected = true;

      const result = await mongoClient.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when MongoDB is not accessible', async () => {
      mongoClient.db = {
        admin: jest.fn().mockReturnValue({
          ping: jest.fn().mockRejectedValue(new Error('Connection failed'))
        })
      };

      const result = await mongoClient.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('storeCSV', () => {
    it('should store CSV with correct metadata', async () => {
      const mockUploadStream = {
        id: 'mock-file-id',
        on: jest.fn(),
        end: jest.fn()
      };

      // Mock the 'finish' event to be called immediately
      mockUploadStream.on.mockImplementation((event, callback) => {
        if (event === 'finish') {
          setTimeout(callback, 0);
        }
      });

      mongoClient.bucket = {
        openUploadStream: jest.fn().mockReturnValue(mockUploadStream)
      };
      mongoClient.isConnected = true;

      const jobId = 'test-job';
      const csvBuffer = Buffer.from('name,age\nJohn,30');
      const filename = 'test.csv';

      const fileId = await mongoClient.storeCSV(jobId, csvBuffer, filename);

      expect(fileId).toBe('mock-file-id');
      expect(mongoClient.bucket.openUploadStream).toHaveBeenCalledWith(
        filename,
        expect.objectContaining({
          metadata: expect.objectContaining({
            jobId,
            contentType: 'text/csv',
            originalName: filename
          })
        })
      );
    });
  });
});
