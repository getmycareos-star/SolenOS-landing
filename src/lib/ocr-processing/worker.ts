import type { OCRJob, OCRJobStatus } from "./types";
import { saveOcrJob, getOcrJob } from "./persistence";
import { processOcrJob } from "./process";
import { createStorageServiceFromEnv } from "../storage/storage-config";
import type { StorageService } from "../storage/storage-service";

/**
 * OCR Processing Configuration
 */
export const OCR_PROCESSING_CONFIG = {
  /** Maximum concurrent OCR jobs */
  maxConcurrency: 2,
  /** Default job priority */
  defaultPriority: "normal" as const,
  /** Default OCR language */
  defaultLanguage: "eng" as const,
  /** Default OCR engine mode */
  defaultEngineMode: "tesseract_lstm_combined" as const,
  /** Job timeout in seconds */
  jobTimeoutSeconds: 300, // 5 minutes
  /** Maximum retry attempts */
  maxRetryAttempts: 3,
  /** Enable automatic retry for transient failures */
  enableAutoRetry: true,
  /** Clean up completed jobs after (hours) */
  cleanupCompletedJobsAfterHours: 24,
  /** Store OCR results in database */
  storeResultsInDb: true,
  /** Make extracted text searchable */
  makeTextSearchable: true,
} as const;

/**
 * OCR Processing Store
 * 
 * In-memory store for tracking OCR job processing state.
 * Follows the same pattern as the situation-entry processing store.
 */

// In-memory store for tracking OCR job processing
const ocrProcessingStore = new Map<string, {
  job: OCRJob;
  status: "processing" | "completed" | "failed";
  startTime: number;
  timeoutId?: NodeJS.Timeout;
}>;

/**
 * Cleanup function to remove old processing records
 */
function reapStaleOcrProcessingRecords(now: number): void {
  for (const [jobId, record] of ocrProcessingStore) {
    const age = now - (record.startTime);
    const maxAge = OCR_PROCESSING_CONFIG.jobTimeoutSeconds * 1000 + 60000; // Timeout + 1 minute buffer
    
    if (age > maxAge) {
      // Job has timed out
      const job = record.job;
      job.status = "failed";
      job.errorMessage = "OCR processing timed out";
      job.completedAt = new Date().toISOString();
      
      saveOcrJob(job);
      ocrProcessingStore.delete(jobId);
      
      if (record.timeoutId) {
        clearTimeout(record.timeoutId);
      }
    }
  }
}

/**
 * Cleanup completed/failed jobs after specified time
 */
function cleanupOldOcrJobs(now: number): void {
  const cutoffTime = now - (OCR_PROCESSING_CONFIG.cleanupCompletedJobsAfterHours * 60 * 60 * 1000);
  
  for (const [jobId, job] of ocrJobs) {
    if (job.status === "completed" || job.status === "failed") {
      const updatedTime = new Date(job.updatedAt).getTime();
      if (updatedTime < cutoffTime) {
        ocrJobs.delete(jobId);
      }
    }
  }
}

/**
 * Periodic cleanup of stale records
 */
setInterval(() => {
  const now = Date.now();
  reapStaleOcrProcessingRecords(now);
  cleanupOldOcrJobs(now);
}, 60 * 1000); // Run every minute

/**
 * Start processing an OCR job
 * 
 * This function is called when a new OCR job is created.
 * It begins the background processing of the job.
 */
export async function startOcrJobProcessing(
  jobId: string
): Promise<void> {
  // Get the job from persistence
  const job = getOcrJob(jobId);
  if (!job) {
    console.error(`[OCR Processing] Job not found: ${jobId}`);
    return;
  }
  
  // Check if job is already being processed
  if (ocrProcessingStore.has(jobId)) {
    console.warn(`[OCR Processing] Job already being processed: ${jobId}`);
    return;
  }
  
  // Update job status to processing
  job.status = "processing";
  job.startedAt = new Date().toISOString();
  saveOcrJob(job);
  
  // Create processing record
  const startTime = Date.now();
  const timeoutId = setTimeout(() => {
    // Handle timeout
    const processingRecord = ocrProcessingStore.get(jobId);
    if (processingRecord) {
      const job = processingRecord.job;
      job.status = "failed";
      job.errorMessage = "OCR processing timed out";
      job.completedAt = new Date().toISOString();
      
      saveOcrJob(job);
      ocrProcessingStore.delete(jobId);
      
      console.error(`[OCR Processing] Job timed out: ${jobId}`);
    }
  }, OCR_PROCESSING_CONFIG.jobTimeoutSeconds * 1000);
  
  ocrProcessingStore.set(jobId, {
    job,
    status: "processing",
    startTime,
    timeoutId,
  });
  
  try {
    // Get storage service
    const storage = createStorageServiceFromEnv();
    
    // Process the job
    const result = await processOcrJob({
      jobId: job.id,
      storage,
      documentId: job.documentId,
      storageKey: job.storageKey,
      originalFilename: job.originalFilename,
      mimeType: job.mimeType,
      fileSize: job.fileSize,
      ocrConfig: {
        language: job.ocrConfig.language,
        engineMode: job.ocrConfig.engineMode,
        psm: job.ocrConfig.psm,
        oem: job.ocrConfig.oem,
      },
      maxRetries: job.maxRetries,
      retryCount: job.retryCount,
    });
    
    // Update job with results
    job.completedAt = new Date().toISOString();
    
    if (result.success) {
      job.status = "completed";
      job.extractedText = result.extractedText ?? null;
      job.ocrConfidence = result.ocrConfidence ?? null;
      job.pageCount = result.metadata?.pageCount ?? 0;
      job.pageResults = result.metadata?.pageResults ?? undefined;
      
      // Update metadata
      if (result.metadata) {
        job.metadata = {
          ...(job.metadata ?? {}),
          processingTimeMs: result.metadata.processingTimeMs,
          hadSelectableText: result.metadata?.hadSelectableText ?? false,
        };
      }
    } else {
      job.status = "failed";
      job.errorMessage = result.errorMessage ?? "Unknown OCR processing error";
      
      // Handle retry logic
      if (OCR_PROCESSING_CONFIG.enableAutoRetry && 
          job.retryCount < job.maxRetries) {
        job.status = "retrying";
        job.retryCount += 1;
        // Add delay before retry (exponential backoff)
        const delay = Math.pow(2, job.retryCount) * 1000; // 2, 4, 8 seconds...
        
        setTimeout(() => {
          // Reset job to queued for retry
          job.status = "queued";
          saveOcrJob(job);
          
          // Start processing again after delay
          void startOcrJobProcessing(jobId);
        }, delay);
        
        // Don't update the job as failed yet since we're retrying
        if (job.status !== "retrying") {
          saveOcrJob(job);
        }
      } else {
        // Max retries exceeded or retry disabled
        saveOcrJob(job);
      }
    }
    
    // Clean up processing record
    const processingRecord = ocrProcessingStore.get(jobId);
    if (processingRecord) {
      if (processingRecord.timeoutId) {
        clearTimeout(processingRecord.timeoutId);
      }
      ocrProcessingStore.delete(jobId);
    }
    
    // Final save
    saveOcrJob(job);
    
    console.log(`[OCR Processing] Job completed: ${jobId} - Status: ${job.status}`);
  } catch (error) {
    // Handle unexpected errors
    job.status = "failed";
    job.errorMessage = error instanceof Error ? error.message : "Unexpected OCR processing error";
    job.completedAt = new Date().toISOString();
    
    // Clean up processing record
    const processingRecord = ocrProcessingStore.get(jobId);
    if (processingRecord) {
      if (processingRecord.timeoutId) {
        clearTimeout(processingRecord.timeoutId);
      }
      ocrProcessingStore.delete(jobId);
    }
    
    saveOcrJob(job);
    
    console.error(`[OCR Processing] Job failed: ${jobId}`, error);
  }
}

/**
 * Get OCR processing statistics
 */
export function getOcrProcessingStats(): {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
} {
  const jobs = [...ocrJobs.values()];
  
  return {
    queued: jobs.filter(j => j.status === "queued").length,
    processing: jobs.filter(j => j.status === "processing").length,
    completed: jobs.filter(j => j.status === "completed").length,
    failed: jobs.filter(j => j.status === "failed").length,
    retrying: jobs.filter(j => j.status === "retrying").length,
  };
}

/**
 * Get OCR processing health
 */
export function getOcrProcessingHealth(): {
  status: "healthy" | "degraded" | "unhealthy";
  queueDepth: number;
  averageProcessingTimeMs: number;
  successRate: number;
  lastError?: string | null;
  lastChecked: string;
} {
  const stats = getOcrProcessingStats();
  const totalFinished = stats.completed + stats.failed;
  
  // Determine health status
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  
  if (stats.failed > 0 && stats.completed === 0) {
    status = "unhealthy";
  } else if (stats.failed > stats.completed * 0.5) { // More than 50% failure rate
    status = "degraded";
  } else if (stats.processing > OCR_PROCESSING_CONFIG.maxConcurrency * 2) {
    status = "degraded"; // Too many jobs processing concurrently
  }
  
  // Calculate success rate
  const successRate = totalFinished > 0 ? stats.completed / totalFinished : 1.0;
  
  // Get most recent error (simplified)
  const recentFailedJobs = [...ocrJobs.values()]
    .filter(job => job.status === "failed")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 1);
  
  const lastError = recentFailedJobs[0]?.errorMessage ?? null;
  
  return {
    status,
    queueDepth: stats.queued + stats.processing + stats.retrying,
    averageProcessingTimeMs: 0, // Would need to track actual processing times
    successRate,
    lastError,
    lastChecked: new Date().toISOString(),
  };
}