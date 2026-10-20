// Image compression service for SolenOS frontend
// Provides client-side image compression before upload to reduce bandwidth and improve performance

/**
 * Compress an image file using browser-image-compression library
 * @param file The image file to compress
 * @param options Compression options (size limit, quality, etc.)
 * @returns Promise that resolves with the compressed file
 */
export async function compressImage(
  file: File,
  options: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    initialQuality?: number;
    compressForce?: boolean;
    rotate?: boolean;
  } = {}
): Promise<File> {
  // Dynamically import the library to avoid bundling issues if not used
  try {
    const { default: imageCompression } = await import('browser-image-compression');
    
    const defaultOptions = {
      maxSizeMB: 0.5, // Default to 0.5MB (500KB) as per requirements
      maxWidthOrHeight: 2000, // Default to 2000px max dimension
      useWebWorker: true, // Use web worker if available
      initialQuality: 0.8, // Start with 80% quality
      compressForce: false, // Don't force compression if already small
      rotate: true, // Auto-rotate based on EXIF orientation
      ...options
    };

    // Validate that the file is an image
    if (!file.type.startsWith('image/')) {
      throw new Error('File is not an image');
    }

    // Compress the image
    const compressedFile = await imageCompression(file, defaultOptions);
    
    // Ensure the file is still a valid image file
    if (!compressedFile.type.startsWith('image/')) {
      throw new Error('Compression resulted in non-image file');
    }
    
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    // If compression fails, return the original file to maintain functionality
    // In a production app, you might want to show an error to the user instead
    return file;
  }
}

/**
 * Calculate the size reduction percentage between original and compressed files
 * @param originalSize Original file size in bytes
 * @param compressedSize Compressed file size in bytes
 * @returns Size reduction percentage (0-100)
 */
export function calculateSizeReduction(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}

/**
 * Convert a data URL to a File object
 * @param dataURL The data URL representing the image
 * @param filename The filename to use for the File object
 * @returns File object
 */
export function dataURLtoFile(dataURL: string, filename: string): File {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
