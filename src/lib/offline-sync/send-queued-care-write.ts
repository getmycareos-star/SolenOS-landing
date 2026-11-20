"use client";

import { postFormData, postJSON } from "@/api/client";

type OfflineFilePayload = {
  offline_kind: "file_upload";
  file_name: string;
  mime_type: string;
  file_base64: string;
  fields: Record<string, string>;
};

function isOfflineFilePayload(payload: unknown): payload is OfflineFilePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "offline_kind" in payload &&
    (payload as { offline_kind?: unknown }).offline_kind === "file_upload" &&
    "file_base64" in payload &&
    typeof (payload as { file_base64?: unknown }).file_base64 === "string"
  );
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Sends either a JSON care write or an encrypted-queue file upload through the same API client. */
export async function sendQueuedCareWrite(endpoint: string, payload: unknown): Promise<unknown> {
  if (isOfflineFilePayload(payload)) {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload.fields)) {
      form.append(key, value);
    }
    const file = new File(
      [decodeBase64(payload.file_base64)],
      payload.file_name,
      { type: payload.mime_type || "application/octet-stream" },
    );
    form.append("file", file);
    const response = await postFormData(endpoint, form) as {
      persisted?: boolean;
      evidence_id?: string;
    };
    if (response?.persisted !== true || typeof response.evidence_id !== "string" || !response.evidence_id) {
      throw new Error("The server did not confirm that the original document was saved.");
    }
    return response;
  }

  const response = await postJSON(endpoint, payload) as {
    success?: boolean;
    id?: string | number;
    ok?: boolean;
    care_event_id?: string;
  };
  if (endpoint === "/situation") {
    if (response?.ok !== true || typeof response.care_event_id !== "string" || !response.care_event_id) {
      throw new Error("The server did not confirm that this care update was saved.");
    }
    return response;
  }
  if (response?.success !== true || response.id === undefined || response.id === null) {
    throw new Error("The server did not confirm that this update was saved.");
  }
  return response;
}
