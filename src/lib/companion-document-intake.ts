export type DocumentIntakeMode = "upload" | "capture" | "scan";

type PendingDocumentIntake = {
  files: File[];
  mode: DocumentIntakeMode;
};

let pendingDocumentIntake: PendingDocumentIntake | null = null;

/**
 * Keeps selected browser File objects in memory while the client navigates
 * from Companion to the Documents library. Files are never serialized or
 * placed in the URL/session storage.
 */
export function setPendingDocumentIntake(files: File[], mode: DocumentIntakeMode): void {
  pendingDocumentIntake = files.length ? { files: [...files], mode } : null;
}

export function consumePendingDocumentIntake(): PendingDocumentIntake | null {
  const pending = pendingDocumentIntake;
  pendingDocumentIntake = null;
  return pending;
}
