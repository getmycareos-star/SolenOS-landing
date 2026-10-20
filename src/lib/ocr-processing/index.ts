export {
  OCR_PROCESSING_SYSTEM_IDENTITY,
  OCR_PROCESSING_ONE_LINE_TRUTH,
  OCR_PROCESSING_SYSTEM_VERSION,
} from "./contract-constants";

export type {
  OCRJobStatus,
  OCRLanguage,
  OCRJobPriority,
  OCREngineMode,
  OCRJob,
  OCRJobResult,
  OCRProcessingStats,
  OCRJobFilters,
  OCRProcessingConfig,
  OCRProcessingHealth,
} from "./types";

export {
  DEFAULT_OCR_CONFIG,
  MAX_FILE_SIZE_BYTES,
  MAX_PDF_PAGES,
  MIN_OCR_CONFIDENCE_THRESHOLD,
  MIN_TEXT_LENGTH_THRESHOLD,
  MAX_OCR_RETRY_ATTEMPTS,
  OCR_RETRY_DELAY_BASE_MS,
} from "./contract-constants";