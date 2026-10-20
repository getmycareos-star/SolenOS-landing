import type { Readable } from "stream";
import { createStorageServiceFromEnv } from "../storage/storage-config";
import type { StorageService } from "../storage/storage-service";
import { createWorker } from "tesseract.js";
import type { OCRJob, OCREngineMode } from "./types";

/**
 * OCR Processing System — Process
 * 
 * Core OCR processing logic that handles the actual text extraction
 * using Tesseract.js and integrates with SolenOS's storage system.
 */

export type OCRProcessParams = {
  /** Unique identifier for the OCR job */
  jobId: string;
  
  /** Storage service instance */
  storage: StorageService;
  
  /** Reference to the stored document */
  documentId: string;
  
  /** Storage key/reference for the document */
  storageKey: string;
  
  /** Original filename of the uploaded document */
  originalFilename: string;
  
  /** MIME type of the document */
  mimeType: string;
  
  /** Size of the document in bytes */
  fileSize: number;
  
  /** OCR configuration to use */
  ocrConfig: {
    language: string;
    engineMode: string;
    psm: number;
    oem: number;
  };
  
  /** Maximum retry attempts allowed */
  maxRetries: number;
  
  /** Current retry count */
  retryCount: number;
};

/**
 * OCR Process Result
 * Returned from the OCR processing function
 */
export interface OCRProcessResult {
  /** Whether the processing was successful */
  success: boolean;
  
  /** Extracted text from the document */
  extractedText?: string | null;
  
  /** OCR confidence score (0-1) */
  ocrConfidence?: number | null;
  
  /** Error message if processing failed */
  errorMessage?: string | null;
  
  /** Processing metadata */
  metadata?: {
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** Number of pages processed */
    pageCount?: number;
    /** Whether the document had selectable text (PDFs) */
    hadSelectableText?: boolean;
    /** Per-page results */
    pageResults?: Array<{
      pageNumber: number;
      text: string;
      confidence: number;
    }>;
  };
};

/**
 * Process an OCR job
 * 
 * @param params - OCR processing parameters
 * @returns Promise resolving to OCR processing result
 */
export async function processOcrJob(params: OCRProcessParams): Promise<OCRProcessResult> {
  const startTime = Date.now();
  
  try {
    // Validate file size
    if (params.fileSize > 25 * 1024 * 1024) { // 25MB limit
      return {
        success: false,
        errorMessage: "File size exceeds 25MB limit for OCR processing",
      };
    }
    
    // Retrieve the document from storage
    const fileBuffer = await params.storage.getFile(params.storageKey);
    
    // Process based on file type
    let result: OCRProcessResult;
    
    if (params.mimeType === "application/pdf") {
      result = await processPdfOcr(fileBuffer, params);
    } else if (params.mimeType.startsWith("image/")) {
      result = await processImageOcr(fileBuffer, params);
    } else {
      // For text-based files, extract text directly
      const text = fileBuffer.toString("utf-8");
      result = {
        success: true,
        extractedText: text,
        ocrConfidence: 1.0, // Perfect confidence for text files
        metadata: {
          processingTimeMs: Date.now() - startTime,
          pageCount: 1,
          hadSelectableText: true,
        },
      };
    }
    
    // Add processing time to metadata
    if (result.metadata) {
      result.metadata.processingTimeMs = Date.now() - startTime;
    } else {
      result.metadata = {
        processingTimeMs: Date.now() - startTime,
      };
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown OCR processing error",
      metadata: {
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Process PDF document for OCR
 */
async function processPdfOcr(
  fileBuffer: Buffer,
  params: OCRProcessParams
): Promise<OCRProcessResult> {
  // For now, we'll treat PDFs as images and process them directly
  // In a full implementation, we would:
  // 1. Check if PDF has selectable text
  // 2. Extract selectable text if available
  // 3. Convert PDF pages to images for pages without selectable text
  // 4. Process each image with OCR
  // 5. Combine results
  
    // Using Tesseract.js directly on PDF (it can handle PDFs)
    const worker = await createWorker();
    
    try {
      // Load the specified language (using deprecated but functional method)
      // Note: This generates a deprecation warning but still works correctly
      await worker.load(params.ocrConfig.language as "eng");
      
      const {
        data: { text, confidence },
      } = await worker.recognize(fileBuffer);
      
      await worker.terminate();
    
    return {
      success: true,
      extractedText: text.trim(),
      ocrConfidence: confidence,
      metadata: {
        pageCount: 1, // Simplified - would need PDF parsing for actual count
        hadSelectableText: false, // Would need to check properly
      },
    };
  } catch (error) {
    await worker.terminate().catch(() => {}); // Best effort cleanup
    throw error;
  }
}

/**
 * Process image document for OCR
 */
async function processImageOcr(
  fileBuffer: Buffer,
  params: OCRProcessParams
): Promise<OCRProcessResult> {
    const worker = await createWorker();
    
    try {
      // Load the specified language (using deprecated but functional method)
      // Note: This generates a deprecation warning but still works correctly
      await worker.load(params.ocrConfig.language as "eng");
      
      const {
        data: { text, confidence },
      } = await worker.recognize(fileBuffer);
      
      await worker.terminate();
    
    return {
      success: true,
      extractedText: text.trim(),
      ocrConfidence: confidence,
      metadata: {
        pageCount: 1,
        hadSelectableText: false,
      },
    };
  } catch (error) {
    await worker.terminate().catch(() => {}); // Best effort cleanup
    throw error;
  }
}