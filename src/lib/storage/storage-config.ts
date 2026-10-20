
import { StorageProviderConfig, StorageProviderType, createStorageService } from './storage-provider';

/**
 * Loads storage configuration from environment variables.
 * 
 * Expected environment variables:
 * - STORAGE_PROVIDER: 'seaweedfs' (default)
 * - STORAGE_ENDPOINT: SeaweedFS S3 endpoint (e.g., 'http://localhost:8333')
 * - STORAGE_ACCESS_KEY_ID: Access key for authentication
 * - STORAGE_SECRET_ACCESS_KEY: Secret key for authentication
 * - STORAGE_BUCKET: Bucket name for storing files
 * - STORAGE_REGION: Region (default: 'us-east-1')
 * - STORAGE_FORCE_PATH_STYLE: 'true' or 'false' (default: 'true' for SeaweedFS)
 */
export function getStorageConfigFromEnv(): StorageProviderConfig {
  const providerType = (process.env.STORAGE_PROVIDER || StorageProviderType.SEAWEEDFS) as StorageProviderType;
  
  const config: StorageProviderConfig = {
    type: providerType,
  };

  if (providerType === StorageProviderType.SEAWEEDFS) {
    config.endpoint = process.env.STORAGE_ENDPOINT || '';
    config.accessKeyId = process.env.STORAGE_ACCESS_KEY_ID || '';
    config.secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY || '';
    config.bucket = process.env.STORAGE_BUCKET || '';
    config.region = process.env.STORAGE_REGION || 'us-east-1';
    const forcePathStyleStr = process.env.STORAGE_FORCE_PATH_STYLE;
    config.forcePathStyle = forcePathStyleStr !== null && forcePathStyleStr !== undefined 
      ? forcePathStyleStr.toLowerCase() === 'true' 
      : true; // Default to true for SeaweedFS
  }
  
  // Validate required fields for SeaweedFS
  if (providerType === StorageProviderType.SEAWEEDFS) {
    if (!config.endpoint) {
      throw new Error('STORAGE_ENDPOINT environment variable is required for SeaweedFS storage');
    }
    if (!config.accessKeyId) {
      throw new Error('STORAGE_ACCESS_KEY_ID environment variable is required for SeaweedFS storage');
    }
    if (!config.secretAccessKey) {
      throw new Error('STORAGE_SECRET_ACCESS_KEY environment variable is required for SeaweedFS storage');
    }
    if (!config.bucket) {
      throw new Error('STORAGE_BUCKET environment variable is required for SeaweedFS storage');
    }
  }
  
  return config;
}

/**
 * Creates a storage service instance based on environment configuration.
 */
export function createStorageServiceFromEnv(): StorageService {
  const config = getStorageConfigFromEnv();
  return createStorageService(config);
}
