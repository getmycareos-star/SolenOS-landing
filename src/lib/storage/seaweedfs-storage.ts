import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { StorageService, StorageOptions, StorageKey, ObjectMetadata } from './storage-service';
import { Readable } from 'stream';

export class SeaweedFSStorage implements StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;
  
  constructor(options: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    region?: string;
    forcePathStyle?: boolean;
  }) {
    this.s3Client = new S3Client({
      endpoint: options.endpoint,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      region: options.region ?? 'us-east-1',
      forcePathStyle: options.forcePathStyle ?? true,
    });
    this.bucket = options.bucket;
    this.region = options.region ?? 'us-east-1';
  }

  async uploadFile(file: File, options: StorageOptions = {}): Promise<StorageKey> {
    const key = options.key ?? `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const metadata = {
      ...(options.metadata ?? {}),
      'original-filename': file.name,
    };
    const contentType = options.contentType ?? file.type ?? 'application/octet-stream';
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    }));
    
    return key;
  }

  async getFile(key: StorageKey): Promise<Buffer> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      
      // Collect all chunks from the stream
      const chunks = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`Failed to retrieve file from SeaweedFS: ${error.message}`);
    }
  }

  async getFileStream(key: StorageKey): Promise<Readable> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return response.Body as Readable;
    } catch (error) {
      throw new Error(`Failed to get file stream from SeaweedFS: ${error.message}`);
    }
  }

  async getDownloadUrl(key: StorageKey, expiresIn: number = 3600): Promise<string> {
    // For SeaweedFS, we might need to implement a custom solution
    // Since SeaweedFS S3 API might not support presigned URLs the same way as AWS
    // For now, we'll construct a direct URL (this might need adjustment based on SeaweedFS setup)
    const endpoint = this.s3Client.config.endpoint?.toString() ?? '';
    // Remove trailing slash if present
    const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    return `${cleanEndpoint}/${this.bucket}/${key}`;
  }

  async deleteFile(key: StorageKey): Promise<void> {
    try {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
    } catch (error) {
      throw new Error(`Failed to delete file from SeaweedFS: ${error.message}`);
    }
  }

  async objectExists(key: StorageKey): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new Error(`Failed to check object existence: ${error.message}`);
    }
  }

  async getObjectMetadata(key: StorageKey): Promise<ObjectMetadata> {
    try {
      const response = await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      
      const etag = response.ETag?.replace(/"/g, '');
      const size = response.ContentLength ?? 0;
      const contentType = response.ContentType ?? 'application/octet-stream';
      const lastModified = response.LastModified ?? new Date();
      const metadata = response.Metadata ?? {};
      
      return {
        size,
        contentType,
        lastModified,
        metadata,
        etag,
      };
    } catch (error) {
      throw new Error(`Failed to get object metadata: ${error.message}`);
    }
  }
}