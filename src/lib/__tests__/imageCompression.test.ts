import { compressImage, calculateSizeReduction, dataURLtoFile } from '../imageCompression';

// Mock File object for testing
const createMockFile = (size: number, type = 'image/png'): File => {
  const content = new Array(size).fill('A').join('');
  return new File([content], 'test.png', { type });
};

describe('Image Compression Service', () => {
  describe('calculateSizeReduction', () => {
    it('should calculate correct size reduction percentage', () => {
      expect(calculateSizeReduction(1000, 500)).toBe(50);
      expect(calculateSizeReduction(1000, 250)).toBe(75);
      expect(calculateSizeReduction(1000, 1000)).toBe(0);
      expect(calculateSizeReduction(1000, 0)).toBe(100);
      expect(calculateSizeReduction(0, 100)).toBe(0);
    });
  });

  describe('dataURLtoFile', () => {
    it('should convert data URL to File object', () => {
      const dataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const file = dataURLtoFile(dataURL, 'test.png');
      
      expect(file.name).toBe('test.png');
      expect(file.type).toBe('image/png');
      expect(file.size).toBeGreaterThan(0);
    });
  });

  describe('compressImage', () => {
    // Note: This test would require actual image files and the browser-image-compression library
    // For now, we're just testing that the function exists and handles errors gracefully
    
    it('should exist', () => {
      expect(typeof compressImage).toBe('function');
    });

    it('should throw error for non-image file', async () => {
      const nonImageFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      try {
        await compressImage(nonImageFile);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toBe('File is not an image');
      }
    });
  });
});