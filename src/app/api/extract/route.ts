import { NextResponse } from 'next/server';
import { createStorageServiceFromEnv } from '@/lib/storage/storage-config';
import { v4 as uuidv4 } from 'uuid';
import { saveOcrJob, getOcrJob } from '@/lib/ocr-processing/persistence';
import { startOcrJobProcessing } from '@/lib/ocr-processing/worker';
import type { OCRJob } from '@/lib/ocr-processing/types';

// POST /api/extract - Handle file upload and create OCR job
export async function POST(request: Request) {
  try {
    // Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (optional but recommended)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: JPEG, PNG, GIF, PDF' },
        { status: 400 }
      );
    }

    // Validate file size (e.g., 25MB limit for OCR)
    const maxSize = 25 * 1024 * 1024; // 25MB
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 25MB limit for OCR processing' },
        { status: 400 }
      );
    }

    // Initialize storage service
    const storage = createStorageServiceFromEnv();
    
    // Generate identifiers
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const jobId = uuidv4();
    
    // Upload file to storage
    const storageKey = await storage.uploadFile(file, {
      key: docId, // Use the docId as the storage key
    });
    
    // Create OCR job record
    const ocrJob: OCRJob = {
      id: jobId,
      documentId: docId,
      storageKey,
      originalFilename: file.name,
      mimeType: file.type,
      fileSize: arrayBuffer.byteLength,
      status: "queued",
      priority: "normal",
      ocrConfig: {
        language: "eng",
        engineMode: "tesseract_lstm_combined",
        psm: 3,
        oem: 3,
      },
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    };
    
    // Save the job
    saveOcrJob(ocrJob);
    
    // Start OCR processing in the background
    void startOcrJobProcessing(jobId);
    
    // Return job information to the client
    return NextResponse.json({
      success: true,
      jobId,
      documentId: docId,
      filename: file.name,
      contentType: file.type,
      size: arrayBuffer.byteLength,
      status: "queued",
      note: "File uploaded successfully. OCR processing started.",
    });
  } catch (error) {
    console.error('Error in /api/extract:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/extract/[jobId] - Check OCR job status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    const job = getOcrJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Return job status and results if available
    const response: any = {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
    
    // Include results if job is completed
    if (job.status === "completed") {
      response.extractedText = job.extractedText;
      response.ocrConfidence = job.ocrConfidence;
      response.pageCount = job.pageCount;
      response.metadata = job.metadata;
    }
    
    // Include error if job failed
    if (job.status === "failed") {
      response.errorMessage = job.errorMessage;
    }
    
    // Include retry info if applicable
    if (job.status === "retrying") {
      response.retryCount = job.retryCount;
      response.maxRetries = job.maxRetries;
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/extract GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}