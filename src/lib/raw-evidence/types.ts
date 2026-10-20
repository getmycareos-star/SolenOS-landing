/**
 * Raw Evidence Store — immutable persistence of caregiver input BEFORE extraction.
 *
 * Spec §3: USER INPUT → SAVE RAW EVIDENCE → CONFIRM PERSISTENCE → START EXTRACTION
 *
 * Raw evidence is the immutable foundation. If extraction fails, the
 * evidence must remain retrievable. This module persists to an in-memory
 * Map (process-lifetime) and optionally to Postgres (when DATABASE_URL is
 * set). File-based durability is used as a local queue for offline resilience
 * (spec §20).
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

export type SaveRawEvidenceResult = {
  evidence: RawEvidence;
  persisted: boolean;
};

export type RawEvidenceStoreOptions = {
  now?: () => Date;
};
