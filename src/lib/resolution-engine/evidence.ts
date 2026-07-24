import {
  FORBIDDEN_RESOLUTION_TRIGGERS,
  RESOLUTION_EVIDENCE_KINDS,
} from "./contract-constants";
import type {
  ForbiddenResolutionTrigger,
  ResolutionEvidence,
  ResolutionEvidenceKind,
} from "./types";

const VALID_KIND_SET = new Set<string>(RESOLUTION_EVIDENCE_KINDS);
const FORBIDDEN_SET = new Set<string>(FORBIDDEN_RESOLUTION_TRIGGERS);

/**
 * Validate evidence for ACTIVE → RESOLVED.
 * Rejects forbidden triggers and empty / assumption-only evidence.
 */
export function validateResolutionEvidence(
  evidence: ResolutionEvidence | null | undefined,
): { ok: true; evidence: ResolutionEvidence } | { ok: false; violations: string[] } {
  const violations: string[] = [];

  if (!evidence) {
    return { ok: false, violations: ["resolution requires evidence"] };
  }

  if (!VALID_KIND_SET.has(evidence.kind)) {
    violations.push(`invalid evidence kind: ${String(evidence.kind)}`);
  }

  if (FORBIDDEN_SET.has(evidence.kind as string)) {
    violations.push(`forbidden trigger used as evidence: ${evidence.kind}`);
  }

  if (!evidence.detail || evidence.detail.trim().length === 0) {
    violations.push("evidence detail required");
  }

  if (!evidence.recordedAt) {
    violations.push("evidence recordedAt required");
  }

  // Confidence alone is never sufficient — forbid LOW_CONFIDENCE as sole basis.
  if (
    evidence.confidence !== undefined &&
    evidence.confidence < 0.35 &&
    !evidence.detail.trim()
  ) {
    violations.push("low confidence alone cannot resolve a situation");
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return { ok: true, evidence };
}

/** Reject explicit forbidden trigger attempts. */
export function assertNotForbiddenTrigger(
  trigger: string,
): { ok: true } | { ok: false; trigger: ForbiddenResolutionTrigger; detail: string } {
  const upper = trigger.toUpperCase().replace(/\s+/g, "_") as ForbiddenResolutionTrigger;
  if (FORBIDDEN_SET.has(upper) || FORBIDDEN_RESOLUTION_TRIGGERS.includes(upper)) {
    return {
      ok: false,
      trigger: upper,
      detail: `${upper} must never auto-resolve a situation`,
    };
  }

  // Soft phrase detection for time/inactivity language as trigger labels.
  const normalized = trigger.toLowerCase();
  if (
    /\belapsed\b/.test(normalized) ||
    /\b(days?|weeks?|months?) (passed|elapsed|since)\b/.test(normalized) ||
    normalized === "timeout" ||
    normalized === "stale"
  ) {
    return {
      ok: false,
      trigger: "ELAPSED_TIME",
      detail: "elapsed time must never auto-resolve a situation",
    };
  }
  if (/\binactiv/.test(normalized) || /\bno activity\b/.test(normalized)) {
    return {
      ok: false,
      trigger: "INACTIVITY",
      detail: "inactivity must never auto-resolve a situation",
    };
  }
  if (
    /\bno (user )?interaction\b/.test(normalized) ||
    /\buser (silent|absent|gone quiet)\b/.test(normalized)
  ) {
    return {
      ok: false,
      trigger: "LACK_OF_USER_INTERACTION",
      detail: "lack of user interaction must never auto-resolve a situation",
    };
  }
  if (/\blow confidence\b/.test(normalized) || normalized === "uncertain") {
    return {
      ok: false,
      trigger: "LOW_CONFIDENCE",
      detail: "low confidence must never auto-resolve a situation",
    };
  }
  if (/\bassum(e|ption)\b/.test(normalized) || /\bprobably (done|resolved)\b/.test(normalized)) {
    return {
      ok: false,
      trigger: "SYSTEM_ASSUMPTION",
      detail: "system assumptions must never auto-resolve a situation",
    };
  }

  return { ok: true };
}

export function isValidEvidenceKind(kind: string): kind is ResolutionEvidenceKind {
  return VALID_KIND_SET.has(kind);
}
