import { apiUrl, safeJson } from "@/lib/api-url";
import type { AttachedDocument } from "@/lib/mvp-workspace";
import type { InputEntryMethod } from "@/lib/input-entry-contract";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";

function createDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Extract file → AttachedDocument. Same path for Scan / Snap / Upload / Share. */
export async function extractAttachedDocument(
  file: File,
  entryMethod: InputEntryMethod,
): Promise<AttachedDocument> {
  const id = createDocId();
  const base: AttachedDocument = {
    id,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    extractedText: "",
    status: "pending",
    entryMethod,
    sourceFile: file,
  };

  if (file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name)) {
    try {
      const text = (await file.text()).trim();
      if (text) {
        return { ...base, extractedText: text, status: "ready" };
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const form = new FormData();
    form.append("file", file);
    // Bound the request so a slow/cold extractor never leaves the UI on "Reading…" forever.
    const controller = new AbortController();
    const timeoutMs = 120_000; // Increased timeout for OCR processing (2 minutes)
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      // Step 1: Upload file and create OCR job
      res = await fetch(apiUrl("/api/extract"), {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    
    let uploadData: {
      success?: boolean;
      jobId?: string;
      documentId?: string;
      note?: string;
      error?: string;
    } = {};
    
    try {
      uploadData = (await safeJson(res)) as typeof uploadData;
    } catch (err) {
      uploadData = { error: err instanceof Error ? err.message : "Upload failed" };
    }

    if (!res.ok || !uploadData.success || !uploadData.jobId) {
      const isImage = file.type.startsWith("image/");
      return {
        ...base,
        status: "failed",
        errorNote: sanitizeCaregiverErrorMessage(
          uploadData.error ??
            (isImage
              ? "Could not upload this image for OCR processing. Type what you see, or try another photo/PDF."
              : "Could not upload this document for OCR processing. Try another file, or type the key details."),
        ),
      };
    }

    // Step 2: Poll for OCR job completion
    const jobId = uploadData.jobId;
    const maxPollingAttempts = 30; // 30 attempts * 5 seconds = 2.5 minutes max
    const pollingIntervalMs = 5000; // 5 seconds
    
    for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
      // Check if we've been aborted
      if (controller.signal.aborted) {
        return {
          ...base,
          status: "failed",
          errorNote: sanitizeCaregiverErrorMessage(
            "Reading this document is taking too long. You can try again, or type the key details."
          ),
        };
      }
      
      // Wait before polling (except for first attempt)
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));
      }
      
      // Check job status
      const statusRes = await fetch(apiUrl(`/api/extract?jobId=${jobId}`), {
        signal: controller.signal,
      });
      
      if (!statusRes.ok) {
        continue; // Try again on next iteration
      }
      
      const statusData = await safeJson(statusRes);
      
      if (statusData.status === "completed") {
        // OCR processing completed successfully
        return {
          ...base,
          id: statusData.jobId ?? jobId,
          name: statusData.name ?? file.name,
          mimeType: statusData.contentType ?? file.type,
          extractedText: statusData.extractedText?.trim() ?? "",
          extractedTextPreview: statusData.extractedText ? 
            statusData.extractedText.substring(0, 100) + (statusData.extractedText.length > 100 ? "..." : "") : "",
          extractedCharCount: statusData.extractedText?.length ?? 0,
          status: "ready",
          ocrConfidence: statusData.ocrConfidence ?? null,
        };
      } else if (statusData.status === "failed") {
        // OCR processing failed
        const isImage = file.type.startsWith("image/");
        return {
          ...base,
          status: "failed",
          errorNote: sanitizeCaregiverErrorMessage(
            statusData.errorMessage ??
              (isImage
                ? "Could not read text from this image. Type what you see, or try another photo/PDF."
                : "Could not read this document. Try another file, or type the key details."),
          ),
        };
      }
      // If still processing or queued, continue polling
    }
    
    // If we've exhausted polling attempts
    return {
      ...base,
      status: "failed",
      errorNote: sanitizeCaregiverErrorMessage(
        "OCR processing is taking longer than expected. You can try again, or type the key details."
      ),
    };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return {
      ...base,
      status: "failed",
      errorNote: sanitizeCaregiverErrorMessage(
        aborted
          ? "Reading this document is taking too long. You can try again, or type the key details."
          : "Could not reach the document reader. You can still type what the document says.",
      ),
    };
  }
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header ?? "")?.[1] ?? "image/jpeg";
  const binary = atob(data ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}
