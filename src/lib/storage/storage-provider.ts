
import { SeaweedFSStorage } from './seaweedfs-storage';
import { StorageService } from './storage-service';

/**
 * Storage provider types supported by the application.
 */
export const StorageProviderType = {
  SEAWEEDFS: 'seaweedfs',
  // Future providers can be added here
  // LOCAL: 'local',
  // S3: 's3',
} as const;

export type StorageProviderType = typeof StorageProviderType[keyof typeof StorageProviderType];

/**
 * Configuration for storage providers.
 */
export interface StorageProviderConfig {
  type: StorageProviderType;
  // Provider-specific configuration
  [key: string]: any;
}

/**
 * Factory function to create storage service instances based on configuration.
 */
export function createStorageService(config: StorageProviderConfig): StorageService {
  switch (config.type) {
    case StorageProviderType.SEAWEEDFS:
      return new SeaweedFSStorage({
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucket: config.bucket,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
      });
    // Future providers can be added here
    // case StorageProviderType.LOCAL:
    //   return new LocalStorageService(config);
    // case StorageProviderType.S3:
    //   return new S3StorageService(config);
     default:
       throw new Error(`Unsupported storage provider type: ${config.type}`);
  }
}
