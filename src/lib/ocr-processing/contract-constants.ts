/**
 * OCR Processing System — Contract Constants
 * 
 * Defines the core constants, types, and configuration for the OCR job processing system.
 */

export const OCR_PROCESSING_SYSTEM_IDENTITY = "ocr-processing";
export const OCR_PROCESSING_ONE_LINE_TRUTH = "Extract text from scanned documents using Tesseract OCR";
export const OCR_PROCESSING_SYSTEM_VERSION = "1.0.0";

/**
 * OCR Job Statuses
 */
export const OCR_JOB_STATUSES = [
  "queued",
  "processing", 
  "completed",
  "failed",
  "retrying"
] as const;

export type OCRJobStatus = typeof OCR_JOB_STATUSES[number];

/**
 * Supported OCR Languages
 * Start with English, can be extended based on actual requirements
 */
export const OCR_SUPPORTED_LANGUAGES = [
  "eng", // English
  // Additional languages can be added here as needed
  // "spa", // Spanish
  // "fra", // French
  // "deu", // German
  // "ita", // Italian
] as const;

export type OCRLanguage = typeof OCR_SUPPORTED_LANGUAGES[number];

/**
 * OCR Job Priority Levels
 */
export const OCR_JOB_PRIORITY = [
  "low",
  "normal", 
  "high"
] as const;

export type OCRJobPriority = typeof OCR_JOB_PRIORITY[number];

/**
 * Default OCR Configuration
 */
export const DEFAULT_OCR_ENGINE_MODES = [
  "tesseract_only",
  "lstm_only", 
  "tesseract_lstm_combined"
] as const;

export type OCREngineMode = typeof DEFAULT_OCR_ENGINE_MODES[number];

export const DEFAULT_OCR_CONFIG = {
  language: "eng" as OCRLanguage,
  engineMode: "tesseract_lstm_combined" as OCREngineMode,
  psm: 3, // Page segmentation mode: Fully automatic page segmentation
  oem: 3, // OCR Engine Mode: Default
  timeoutSeconds: 30,
  maxImageSizePixels: 100_000_000, // ~100MP limit
} as const;

/**
 * File Size Limits
 */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB limit for OCR processing
export const MAX_PDF_PAGES = 50; // Maximum pages to process in a single PDF

/**
 * OCR Quality Thresholds
 */
export const MIN_OCR_CONFIDENCE_THRESHOLD = 0.3; // Below this, flag as low quality
export const MIN_TEXT_LENGTH_THRESHOLD = 10; // Minimum characters to consider extraction successful

/**
 * Retry Configuration
 */
export const MAX_OCR_RETRY_ATTEMPTS = 3;
export const OCR_RETRY_DELAY_BASE_MS = 1000; // Base delay for exponential backoff