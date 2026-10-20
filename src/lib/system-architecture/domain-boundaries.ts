/**
 * Domain module ownership map — each module owns its concerns exclusively.
 * Cross-module imports must respect forbidden boundaries below.
 */

export const DOMAIN_MODULES = [
  "identity",
  "case",
  "document",
  "memory",
  "decision",
  "safety",
  "notification",
  "telemetry",
] as const;

export type DomainModule = (typeof DOMAIN_MODULES)[number];

export interface DomainBoundary {
  module: DomainModule;
  owns: readonly string[];
  forbidden: readonly string[];
}

export const DOMAIN_BOUNDARIES: readonly DomainBoundary[] = [
  {
    module: "identity",
    owns: ["user creation", "authentication", "sessions"],
    forbidden: [
      "caregiving logic",
      "memory storage",
      "document processing",
      "decision generation",
      "case lifecycle",
    ],
  },
  {
    module: "case",
    owns: ["case creation", "ownership", "lifecycle", "case-scoped continuity"],
    forbidden: ["global user memory", "decision generation", "document OCR", "notifications"],
  },
  {
    module: "document",
    owns: ["uploads", "extraction", "storage references", "evidence metadata"],
    forbidden: ["decisions", "conclusions", "risk classification", "notification scheduling"],
  },
  {
    module: "memory",
    owns: ["continuity", "case history", "context retrieval", "context storage"],
    forbidden: [
      "conclusion generation",
      "global user profiling",
      "decision output",
      "auth",
      "notifications",
    ],
  },
  {
    module: "decision",
    owns: ["cognitive decompression output", "5-field structured output"],
    forbidden: ["storage", "auth", "notifications", "telemetry writes", "case CRUD"],
  },
  {
    module: "safety",
    owns: ["urgency detection", "CRITICAL escalation", "LOW/MEDIUM/HIGH/CRITICAL classification"],
    forbidden: ["notification delivery", "decision storage", "memory persistence", "auth"],
  },
  {
    module: "notification",
    owns: ["delivery timing", "scheduling", "suppression rules"],
    forbidden: ["emotional reasoning", "decision generation", "memory writes", "risk classification"],
  },
  {
    module: "telemetry",
    owns: ["relief scoring", "interaction logging", "observability", "event emission"],
    forbidden: ["decision generation", "conclusion generation", "notification content authoring"],
  },
] as const;

/** Memory continuity is case-scoped — never global user profiling. */
export const CASE_SCOPED_MEMORY_RULE =
  "All memory continuity is scoped to a case; SolenOS does NOT maintain global user profiles or longitudinal behavioral models.";
