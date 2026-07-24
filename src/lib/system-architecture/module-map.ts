import type { DomainModule } from "./domain-boundaries";

/**
 * Maps existing src/lib paths to domain modules.
 * Modular monolith — all paths resolve within this repository.
 */
export interface DomainModuleMapping {
  module: DomainModule;
  entryPoint: string;
  implementationPaths: readonly string[];
  description: string;
}

export const DOMAIN_MODULE_MAP: readonly DomainModuleMapping[] = [
  {
    module: "identity",
    entryPoint: "src/lib/domains/identity",
    implementationPaths: [
      "src/lib/telemetry-persistence/server.ts",
      "db/migrations/001_telemetry_schema.sql",
      "db/migrations/005_postgres_evidence_contract.sql",
    ],
    description: "User creation via telemetry store; optional auth columns in migration 005.",
  },
  {
    module: "case",
    entryPoint: "src/lib/domains/case",
    implementationPaths: ["db/migrations/009_system_architecture_foundation.sql"],
    description: "Case-scoped continuity — MVP contract + cases table only.",
  },
  {
    module: "document",
    entryPoint: "src/lib/domains/document",
    implementationPaths: ["src/lib/document-intake", "src/lib/document-intelligence"],
    description: "Document uploads, tagging, extraction evidence, and intelligence graph nodes — not decisions.",
  },
  {
    module: "memory",
    entryPoint: "src/lib/domains/memory",
    implementationPaths: ["src/lib/system-architecture/state-models.ts"],
    description: "Context storage only — stores context, never generates conclusions.",
  },
  {
    module: "decision",
    entryPoint: "src/lib/domains/decision",
    implementationPaths: [
      "src/lib/analyze-pipeline",
      "src/lib/response-validator",
      "src/lib/input-classification",
      "src/lib/cognitive-compression",
      "src/lib/non-assistant-output",
    ],
    description: "SolenOS cognitive decompression — 5-field structured output.",
  },
  {
    module: "safety",
    entryPoint: "src/lib/domains/safety",
    implementationPaths: ["src/lib/urgency-detection", "src/lib/safety-override"],
    description: "Urgency detection and CRITICAL escalation — owns risk levels only.",
  },
  {
    module: "notification",
    entryPoint: "src/lib/domains/notification",
    implementationPaths: ["src/lib/support-signal-system"],
    description: "Delivery timing and scheduling — no emotional reasoning or decision generation.",
  },
  {
    module: "telemetry",
    entryPoint: "src/lib/domains/telemetry",
    implementationPaths: [
      "src/lib/telemetry-persistence",
      "src/lib/postgres-contract",
      "src/lib/system-architecture/emit-event.ts",
    ],
    description: "Relief scoring, interaction logging, append-only event emission.",
  },
] as const;

export function getDomainModulePaths(module: DomainModule): readonly string[] {
  const mapping = DOMAIN_MODULE_MAP.find((m) => m.module === module);
  return mapping?.implementationPaths ?? [];
}
