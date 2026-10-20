
/**
 * Abstract storage service interface for document persistence.
 * Provides a provider-independent way to store and retrieve binary files.
 */

export interface StorageService {
  /**
   * Upload a file to persistent storage.
   * @param file - The file to upload
   * @param options - Optional metadata and configuration
   * @returns Promise resolving to the storage key/reference for the uploaded file
   */
  uploadFile(file: File, options?: StorageOptions): Promise<StorageKey>;

  /**
   * Retrieve a file from persistent storage.
   * @param key - The storage key/reference of the file to retrieve
   * @returns Promise resolving to the file data as a Buffer
   */
  getFile(key: StorageKey): Promise<Buffer>;

  /**
   * Get a readable stream for a file (for large files).
   * @param key - The storage key/reference of the file
   * @returns Promise resolving to a readable stream
   */
  getFileStream(key: StorageKey): Promise<Readable>;

  /**
   * Generate a short-lived download URL for a file.
   * @param key - The storage key/reference of the file
   * @param expiresIn - Optional expiration time in seconds (default: 3600)
   * @returns Promise resolving to the download URL
   */
  getDownloadUrl(key: StorageKey, expiresIn?: number): Promise<string>;

  /**
   * Delete a file from persistent storage.
   * @param key - The storage key/reference of the file to delete
   * @returns Promise resolving when deletion is complete
   */
  deleteFile(key: StorageKey): Promise<void>;

  /**
   * Check if an object exists in storage.
   * @param key - The storage key/reference to check
   * @returns Promise resolving to true if exists, false otherwise
   */
  objectExists(key: StorageKey): Promise<boolean>;

  /**
   * Get metadata about an object in storage.
   * @param key - The storage key/reference
   * @returns Promise resolving to object metadata
   */
  getObjectMetadata(key: StorageKey): Promise<ObjectMetadata>;
}

/**
 * Options for file upload.
 */
export interface StorageOptions {
  /** Optional custom storage key (if not provided, one will be generated) */
  key?: StorageKey;
  /** Optional content type override */
  contentType?: string;
  /** Optional metadata to store with the object */
  metadata?: Record<string, string>;
}

/**
 * Reference to a stored object.
 */
export type StorageKey = string;

/**
 * Metadata about a stored object.
 */
export interface ObjectMetadata {
  /** Size of the object in bytes */
  size: number;
  /** Content type (MIME type) */
  contentType: string;
  /** Last modified timestamp */
  lastModified: Date;
  /** Optional user-defined metadata */
  metadata?: Record<string, string>;
  /** Optional entity tag for cache validation */
  etag?: string;
}

/**
 * Node.js Readable stream type.
 */
export interface Readable {
  read(size?: number): string | Buffer | null;
  pipe(destination: Writable, options?: { end?: boolean }): Writable;
  unpipe(destination?: Writable): this;
  destroy(error?: Error): void;
}

/**
 * Node.js Writable stream type.
 */
export interface Writable {
  write(chunk: any, encoding?: boolean, callback?: (error: Error | null) => void): boolean;
  end(callback?: (error: Error | null) => void): void;
  end(chunk: any, encoding?: boolean, callback?: (error: Error | null) => void): boolean;
  destroy(error?: Error): void;
}
