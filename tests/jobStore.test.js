const jobStore = require('../src/services/jobStore');

describe('JobStore', () => {
  beforeEach(() => {
    // Clear all jobs before each test
    const allJobs = jobStore.getAllJobs();
    allJobs.forEach(([jobId]) => {
      jobStore.jobs.delete(jobId);
    });
  });

  describe('createJob', () => {
    it('should create a new job with processing status', () => {
      const jobId = 'test-job-123';
      const filename = 'test.pdf';
      
      const job = jobStore.createJob(jobId, filename);
      
      expect(job).toBeDefined();
      expect(job.status).toBe('processing');
      expect(job.filenamePdf).toBe(filename);
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
    });

    it('should store the job and make it retrievable', () => {
      const jobId = 'test-job-456';
      const filename = 'another.pdf';
      
      jobStore.createJob(jobId, filename);
      const retrieved = jobStore.getJob(jobId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.filenamePdf).toBe(filename);
      expect(retrieved.status).toBe('processing');
    });
  });

  describe('getJob', () => {
    it('should return null for non-existent job', () => {
      const job = jobStore.getJob('non-existent-job');
      expect(job).toBeNull();
    });

    it('should return the correct job when it exists', () => {
      const jobId = 'existing-job';
      const filename = 'exists.pdf';
      
      jobStore.createJob(jobId, filename);
      const job = jobStore.getJob(jobId);
      
      expect(job).toBeDefined();
      expect(job.filenamePdf).toBe(filename);
    });
  });

  describe('updateJob', () => {
    it('should update job fields and updatedAt timestamp', async () => {
      const jobId = 'update-test-job';
      const filename = 'update.pdf';
      
      jobStore.createJob(jobId, filename);
      const originalJob = jobStore.getJob(jobId);
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updates = { status: 'done', r2Key: 'test-key' };
      const updatedJob = jobStore.updateJob(jobId, updates);
      
      expect(updatedJob).toBeDefined();
      expect(updatedJob.status).toBe('done');
      expect(updatedJob.r2Key).toBe('test-key');
      expect(updatedJob.filenamePdf).toBe(filename); // Should preserve original
      expect(updatedJob.updatedAt.getTime()).toBeGreaterThan(
        originalJob.updatedAt.getTime()
      );
    });

    it('should return null for non-existent job', () => {
      const result = jobStore.updateJob('non-existent', { status: 'done' });
      expect(result).toBeNull();
    });
  });

  describe('completeJob', () => {
    it('should mark job as done with R2 details', () => {
      const jobId = 'complete-test-job';
      const filename = 'complete.pdf';
      const r2Key = 'jobs/complete-test-job/123456.csv';
      const presignedUrl = 'https://r2.example.com/signed-url';
      
      jobStore.createJob(jobId, filename);
      const completedJob = jobStore.completeJob(jobId, r2Key, presignedUrl);
      
      expect(completedJob).toBeDefined();
      expect(completedJob.status).toBe('done');
      expect(completedJob.r2Key).toBe(r2Key);
      expect(completedJob.presignedUrl).toBe(presignedUrl);
    });
  });

  describe('failJob', () => {
    it('should mark job as error with error message', () => {
      const jobId = 'fail-test-job';
      const filename = 'fail.pdf';
      const errorMessage = 'Processing failed';
      
      jobStore.createJob(jobId, filename);
      const failedJob = jobStore.failJob(jobId, errorMessage);
      
      expect(failedJob).toBeDefined();
      expect(failedJob.status).toBe('error');
      expect(failedJob.error).toBe(errorMessage);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      // Create jobs with different statuses
      jobStore.createJob('processing-1', 'proc1.pdf');
      jobStore.createJob('processing-2', 'proc2.pdf');
      
      const doneJobId = 'done-job';
      jobStore.createJob(doneJobId, 'done.pdf');
      jobStore.completeJob(doneJobId, 'key', 'url');
      
      const errorJobId = 'error-job';
      jobStore.createJob(errorJobId, 'error.pdf');
      jobStore.failJob(errorJobId, 'Test error');
      
      const stats = jobStore.getStats();
      
      expect(stats.total).toBe(4);
      expect(stats.processing).toBe(2);
      expect(stats.done).toBe(1);
      expect(stats.error).toBe(1);
    });

    it('should return zero stats when no jobs exist', () => {
      const stats = jobStore.getStats();
      
      expect(stats.total).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.done).toBe(0);
      expect(stats.error).toBe(0);
    });
  });

  describe('getAllJobs', () => {
    it('should return all jobs as [jobId, job] pairs', () => {
      const job1Id = 'job1';
      const job2Id = 'job2';
      
      jobStore.createJob(job1Id, 'file1.pdf');
      jobStore.createJob(job2Id, 'file2.pdf');
      
      const allJobs = jobStore.getAllJobs();
      
      expect(allJobs).toHaveLength(2);
      expect(allJobs).toEqual(
        expect.arrayContaining([
          [job1Id, expect.objectContaining({ filenamePdf: 'file1.pdf' })],
          [job2Id, expect.objectContaining({ filenamePdf: 'file2.pdf' })]
        ])
      );
    });
  });
});
