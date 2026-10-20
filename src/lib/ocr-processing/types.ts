import type { Readable } from "stream";

/**
 * OCR Processing System — Types
 * 
 * TypeScript definitions for the OCR job processing system.
 */

export type OCRJobStatus = "queued" | "processing" | "completed" | "failed" | "retrying";
export type OCRLanguage = "eng"; // Will expand as needed
export type OCRJobPriority = "low" | "normal" | "high";
export type OCREngineMode = "tesseract_only" | "lstm_only" | "tesseract_lstm_combined";

/**
 * OCR Job Definition
 * Represents a single OCR processing job in the queue
 */
export interface OCRJob {
  /** Unique identifier for the job */
  id: string;
  
  /** Reference to the stored document */
  documentId: string;
  
  /** Storage key/reference for the document in SeaweedFS/S3 */
  storageKey: string;
  
  /** Original filename of the uploaded document */
  originalFilename: string;
  
  /** MIME type of the document */
  mimeType: string;
  
  /** Size of the document in bytes */
  fileSize: number;
  
  /** Current processing status */
  status: OCRJobStatus;
  
  /** Priority level for job processing */
  priority: OCRJobPriority;
  
  /** OCR configuration to use */
  ocrConfig: {
    language: OCRLanguage;
    engineMode: OCREngineMode;
    psm: number;
    oem: number;
  };
  
  /** Number of times this job has been retried */
  retryCount: number;
  
  /** Maximum retry attempts allowed */
  maxRetries: number;
  
  /** When the job was created */
  createdAt: string; // ISO timestamp
  
  /** When the job was last updated */
  updatedAt: string; // ISO timestamp
  
  /** When processing started (if applicable) */
  startedAt?: string; // ISO timestamp
  
  /** When processing completed (if applicable) */
  completedAt?: string; // ISO timestamp
  
  /** Error message if job failed */
  errorMessage?: string | null;
  
  /** Extracted text result (when completed) */
  extractedText?: string | null;
  
  /** OCR confidence score (0-1) */
  ocrConfidence?: number | null;
  
  /** Number of pages processed (for multi-page documents) */
  pageCount?: number;
  
  /** Per-page results (optional) */
  pageResults?: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
  
  /** Metadata about the OCR process */
  metadata: {
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** Memory used during processing (approx) */
    memoryUsedMb?: number;
    /** Image dimensions if applicable */
    imageWidth?: number;
    imageHeight?: number;
    /** Whether the document had selectable text (PDFs) */
    hadSelectableText?: boolean;
    /** OCR engine version */
    ocrEngineVersion?: string;
  };
}

/**
 * OCR Job Result
 * Returned when querying job status or after completion
 */
export interface OCRJobResult {
  job: OCRJob;
  success: boolean;
  extractedText?: string | null;
  ocrConfidence?: number | null;
  errorMessage?: string | null;
}

/**
 * OCR Processing Statistics
 */
export interface OCRProcessingStats {
  /** Total jobs processed */
  totalJobs: number;
  /** Successfully completed jobs */
  completedJobs: number;
  /** Failed jobs */
  failedJobs: number;
  /** Currently processing jobs */
  processingJobs: number;
  /** Queued jobs waiting to be processed */
  queuedJobs: number;
  /** Average processing time (ms) */
  averageProcessingTimeMs: number;
  /** Average OCR confidence score */
  averageOcrConfidence: number;
}

/**
 * OCR Job Filters
 * Used when querying jobs
 */
export interface OCRJobFilters {
  /** Filter by job status */
  status?: OCRJobStatus | OCRJobStatus[];
  /** Filter by priority */
  priority?: OCRJobPriority | OCRJobPriority[];
  /** Filter by date range */
  createdAfter?: string; // ISO timestamp
  createdBefore?: string; // ISO timestamp
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * OCR Processing Configuration
 */
export interface OCRProcessingConfig {
  /** Maximum concurrent OCR jobs */
  maxConcurrency: number;
  /** Default job priority */
  defaultPriority: OCRJobPriority;
  /** Default OCR language */
  defaultLanguage: OCRLanguage;
  /** Default OCR engine mode */
  defaultEngineMode: OCREngineMode;
  /** Job timeout in seconds */
  jobTimeoutSeconds: number;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  /** Enable automatic retry for transient failures */
  enableAutoRetry: boolean;
  /** Clean up completed jobs after (hours) */
  cleanupCompletedJobsAfterHours: number;
  /** Store OCR results in database */
  storeResultsInDb: boolean;
  /** Make extracted text searchable */
  makeTextSearchable: boolean;
}

/**
 * OCR Processing Health Status
 */
export interface OCRProcessingHealth {
  /** Overall system status */
  status: "healthy" | "degraded" | "unhealthy";
  /** Whether the OCR worker is running */
  workerRunning: boolean;
  /** Queue depth */
  queueDepth: number;
  /** Average processing time */
  averageProcessingTimeMs: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Last error (if any) */
  lastError?: string | null;
  /** Timestamp of last health check */
  lastChecked: string; // ISO timestamp
}