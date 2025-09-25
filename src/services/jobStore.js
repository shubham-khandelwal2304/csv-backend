/**
 * In-memory job store with TTL cleanup
 * 
 * Job structure: {
 *   status: 'processing' | 'done' | 'error',
 *   filenamePdf: string,
 *   r2Key?: string,
 *   presignedUrl?: string,
 *   error?: string,
 *   createdAt: Date,
 *   updatedAt: Date
 * }
 * 
 * Note: This is an in-memory implementation suitable for single-instance deployments.
 * For production scale, replace with Redis or MongoDB for persistence and multi-instance support.
 */

class JobStore {
  constructor() {
    this.jobs = new Map();
    this.TTL_HOURS = 24;
    
    // Start cleanup interval - every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Create a new job
   * @param {string} jobId 
   * @param {string} filenamePdf 
   * @returns {object} The created job
   */
  createJob(jobId, filenamePdf) {
    const job = {
      status: 'processing',
      filenamePdf,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.jobs.set(jobId, job);
    return job;
  }

  /**
   * Get a job by ID
   * @param {string} jobId 
   * @returns {object|null} The job or null if not found
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Update job status and other fields
   * @param {string} jobId 
   * @param {object} updates 
   * @returns {object|null} The updated job or null if not found
   */
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    Object.assign(job, updates, { updatedAt: new Date() });
    this.jobs.set(jobId, job);
    return job;
  }

  /**
   * Mark job as completed with R2 details
   * @param {string} jobId 
   * @param {string} r2Key 
   * @param {string} presignedUrl 
   * @returns {object|null} The updated job or null if not found
   */
  completeJob(jobId, r2Key, presignedUrl) {
    return this.updateJob(jobId, {
      status: 'done',
      r2Key,
      presignedUrl
    });
  }

  /**
   * Mark job as failed
   * @param {string} jobId 
   * @param {string} error 
   * @returns {object|null} The updated job or null if not found
   */
  failJob(jobId, error) {
    return this.updateJob(jobId, {
      status: 'error',
      error
    });
  }

  /**
   * Get all jobs (for debugging)
   * @returns {Array} Array of [jobId, job] pairs
   */
  getAllJobs() {
    return Array.from(this.jobs.entries());
  }

  /**
   * Clean up old jobs (older than TTL_HOURS)
   */
  cleanup() {
    const cutoffTime = new Date(Date.now() - (this.TTL_HOURS * 60 * 60 * 1000));
    let cleanedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffTime) {
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old jobs (older than ${this.TTL_HOURS}h)`);
    }
  }

  /**
   * Get store statistics
   * @returns {object} Stats about the job store
   */
  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      processing: jobs.filter(j => j.status === 'processing').length,
      done: jobs.filter(j => j.status === 'done').length,
      error: jobs.filter(j => j.status === 'error').length
    };
  }

  /**
   * Cleanup interval on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
const jobStore = new JobStore();

// Cleanup on process exit
process.on('SIGTERM', () => jobStore.destroy());
process.on('SIGINT', () => jobStore.destroy());

module.exports = jobStore;
