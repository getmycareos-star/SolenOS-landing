import type { ReactNode } from "react";

/**
 * Backwards-compatible wrapper for old imports.
 *
 * Product decision: opening the Living Care Record must never be blocked by an
 * early-version acknowledgement checkbox. Keep this wrapper transparent until
 * all legacy imports are removed.
 */
export function ResearchPreviewAckGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
