/**
 * Legacy raw-capture recovery types.
 *
 * A local queue is not a care-record write. Only an explicitly confirmed
 * write to the canonical SolenOS backend may set persisted=true.
 */

import { createHash } from "node:crypto";
import { detectUrgencyLevel } from "../urgency-detection";

export type RawEvidenceInputType =
  | "text"
  | "ocr_text"
  | "pdf"
  | "image"
  | "voice_transcript"
  | "message"
  | "import";

export type UrgencyRiskLevel = "low" | "medium" | "high" | "critical";

export type RawEvidence = {
  id: string;
  caregiver_id: string;
  person_id: string | null;
  input_type: RawEvidenceInputType;
  content: string;
  content_hash: string;
  ocr_confidence: number | null;
  document_id: string | null;
  document_name: string | null;
  captured_at: string;
  urgency_risk_level: UrgencyRiskLevel | null;
  urgency_signals: string[];
  metadata: Record<string, unknown>;
};

export type SaveRawEvidenceInput = {
  id?: string;
  caregiver_id: string;
  person_id?: string | null;
  input_type: RawEvidenceInputType;
  content: string;
  ocr_confidence?: number | null;
  document_id?: string | null;
  document_name?: string | null;
  captured_at?: string;
  metadata?: Record<string, unknown>;
};

export type RawEvidencePersistenceStatus =
  | "server_persisted"
  | "local_queued"
  | "memory_only";

export type SaveRawEvidenceResult = {
  evidence: RawEvidence;
  /** True only when the canonical SolenOS backend confirmed the write. */
  persisted: boolean;
  persistence_status: RawEvidencePersistenceStatus;
  persistence_error?: string;
};

export type RawEvidenceStoreOptions = {
  now?: () => Date;
};
