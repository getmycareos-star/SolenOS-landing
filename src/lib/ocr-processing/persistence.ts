import type { OCRJob } from "./types";

/**
 * OCR Processing System — Persistence
 * 
 * In-memory storage for OCR job states.
 * NOTE: For production, this should be replaced with persistent storage (database).
 */

// In-memory store for OCR jobs
const ocrJobs = new Map<string, OCRJob>();

/**
 * Get an OCR job by its ID
 */
export function getOcrJob(jobId: string): OCRJob | undefined {
  return ocrJobs.get(jobId);
}

/**
 * Save an OCR job
 */
export function saveOcrJob(job: OCRJob): OCRJob {
  const jobToSave = {
    ...job,
    updatedAt: new Date().toISOString(),
  };
  ocrJobs.set(job.id, jobToSave);
  return jobToSave;
}

/**
 * Delete an OCR job
 */
export function deleteOcrJob(jobId: string): boolean {
  return ocrJobs.delete(jobId);
}

/**
 * Get all OCR jobs
 */
export function getAllOcrJobs(): OCRJob[] {
  return [...ocrJobs.values()];
}

/**
 * Get OCR jobs by status
 */
export function getOcrJobsByStatus(status: OCRJob["status"]): OCRJob[] {
  return [...ocrJobs.values()].filter(job => job.status === status);
}

/**
 * Get OCR jobs by document ID
 */
export function getOcrJobsByDocumentId(documentId: string): OCRJob[] {
  return [...ocrJobs.values()].filter(job => job.documentId === documentId);
}

/**
 * Clear all OCR jobs (for testing)
 */
export function clearAllOcrJobs(): void {
  ocrJobs.clear();
}

/**
 * Count OCR jobs by status
 */
export function countOcrJobsByStatus(status: OCRJob["status"]): number {
  return getOcrJobsByStatus(status).length;
}