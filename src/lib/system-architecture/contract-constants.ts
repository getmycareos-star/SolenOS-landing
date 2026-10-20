/**
 * SolenOS System Architecture Contract — MVP foundation.
 * Deterministic cognitive decompression engine — NOT care management, workflow engine,
 * caregiving OS, or autonomous AI memory agent.
 */

export const SOLENOS_SYSTEM_PURPOSE =
  "Deterministic cognitive decompression — convert unstructured caregiver input into structured clarity under uncertainty.";

/** Modular monolith: isolated domain modules within one deployable unit. */
export const MODULAR_MONOLITH_PRINCIPLE =
  "One deployable monolith with eight isolated, replaceable, testable domain modules — no distributed runtime.";

export const FORBIDDEN_ARCHITECTURES = [
  "microservices",
  "kubernetes",
  "k8s",
  "service mesh",
  "multi-repo service split",
  "distributed orchestration",
] as const;

/** Implementation filter — every feature must answer this before building. */
export const ARCHITECTURE_GUARDRAIL_QUESTION =
  "Does this reduce cognitive load for the caregiver?";

export const ARCHITECTURE_FINAL_DIRECTIVE =
  "If it does not reduce caregiver cognitive load, do not build it.";

/** Event-first: append-only history — never mutate past events. */
export const EVENT_FIRST_PRINCIPLE =
  "Domain state changes emit append-only events; history is never mutated or deleted.";

/** Document processing is async and must never block decompression output. */
export const DOCUMENT_ASYNC_PIPELINE = [
  "Upload",
  "Queue",
  "OCR",
  "Extraction",
  "Parsing",
  "Case Attachment",
  "Memory Update",
] as const;

/** Failure isolation: auxiliary pipeline failures must not break core output. */
export const FAILURE_ISOLATION_BOUNDARIES = [
  "OCR/extraction failures do not block decompression output",
  "Notification delivery failures do not block decompression output",
  "Telemetry write failures do not block decompression output",
  "Document async pipeline completion is not a prerequisite for analyze",
] as const;
