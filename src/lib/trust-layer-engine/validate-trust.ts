import type { TrustLayerBlock } from "./types";

export function validateTrustLayer(block: TrustLayerBlock): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(block.known)) {
    errors.push("known field absent");
  }
  if (!Array.isArray(block.assumed)) {
    errors.push("assumed field absent");
  }
  if (!Array.isArray(block.unknown)) {
    errors.push("unknown field absent");
  }
  if (block.unknown.length === 0) {
    errors.push("unknown must be explicitly surfaced — cannot be empty");
  }
  if (block.recency.freshness_score < 0 || block.recency.freshness_score > 1) {
    errors.push("recency freshness_score must be 0.0–1.0");
  }
  if (block.confidence < 0 || block.confidence > 1) {
    errors.push("confidence must be 0.0–1.0");
  }
  if (block.confidence >= 1) {
    errors.push("confidence must never be 1.0 unless fully verified");
  }

  for (const item of block.assumed) {
    if (!item.statement.toLowerCase().includes("possible") &&
        !item.statement.toLowerCase().includes("likely") &&
        !item.statement.toLowerCase().includes("may") &&
        !item.reasoning_basis) {
      /* assumed items must have reasoning basis — enforced structurally */
    }
    if (!item.reasoning_basis.trim()) {
      errors.push(`assumed item missing reasoning basis: ${item.statement.slice(0, 40)}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
