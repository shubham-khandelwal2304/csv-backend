const { generateJobId, isValidJobId } = require('../src/utils/ids');

describe('ID Utilities', () => {
  describe('generateJobId', () => {
    it('should generate a 12-character ID', () => {
      const jobId = generateJobId();
      expect(jobId).toHaveLength(12);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateJobId());
      }
      expect(ids.size).toBe(1000); // All should be unique
    });

    it('should generate URL-safe characters only', () => {
      const jobId = generateJobId();
      expect(jobId).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('isValidJobId', () => {
    it('should accept valid 12-character job IDs', () => {
      const validIds = [
        'abcdefghijkl',
        'ABCDEFGHIJKL',
        '123456789012',
        'aB3_-9XyZ012',
        '_-_-_-_-_-_-'
      ];

      validIds.forEach(id => {
        expect(isValidJobId(id)).toBe(true);
      });
    });

    it('should reject invalid job IDs', () => {
      const invalidIds = [
        null,
        undefined,
        '',
        'short',
        'toolongtobevalid',
        'has spaces in',
        'has@special!',
        'has.periods.',
        'has/slashes/',
        123456789012, // number instead of string
        {}
      ];

      invalidIds.forEach(id => {
        expect(isValidJobId(id)).toBe(false);
      });
    });

    it('should reject IDs with wrong length', () => {
      expect(isValidJobId('a')).toBe(false); // too short
      expect(isValidJobId('abcdefghijk')).toBe(false); // 11 chars
      expect(isValidJobId('abcdefghijklm')).toBe(false); // 13 chars
    });

    it('should work with generated IDs', () => {
      for (let i = 0; i < 100; i++) {
        const jobId = generateJobId();
        expect(isValidJobId(jobId)).toBe(true);
      }
    });
  });
});
