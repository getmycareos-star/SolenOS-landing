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
    const res = await fetch("/api/extract", { method: "POST", body: form });
    const data = (await res.json()) as {
      ok?: boolean;
      text?: string;
      note?: string;
      message?: string;
      error?: string;
    };

    if (!res.ok || !data.ok || !data.text?.trim()) {
      const isImage = file.type.startsWith("image/");
      return {
        ...base,
        status: "failed",
        errorNote: sanitizeCaregiverErrorMessage(
          data.note ??
            data.message ??
            data.error ??
            (isImage
              ? "Could not read text from this image yet. Type what you see, or try another photo/PDF."
              : "Could not read this document. Try another file, or type the key details."),
        ),
      };
    }

    return { ...base, extractedText: data.text.trim(), status: "ready" };
  } catch {
    return {
      ...base,
      status: "failed",
      errorNote: "Could not reach the document reader. You can still type what the document says.",
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
