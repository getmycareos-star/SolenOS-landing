/** Assumption Registry — temporary beliefs influencing decisions, NOT truth storage. */

export const ASSUMPTION_REGISTRY_LAYER_IDENTITY =
  "a lightweight validation layer storing active assumptions currently influencing decisions — inspectable, validatable, invalidatable, and expirable temporary beliefs, not memory, profile, or knowledge graph";

export const ASSUMPTION_REGISTRY_LAYER_ONE_LINE_TRUTH =
  "Assumptions are temporary beliefs that bias priority — never facts, never permanent, and never merged into memory or Care Profile identity.";

export const ASSUMPTION_REGISTRY_LAYER_PIPELINE_POSITION =
  "ASSUMPTION REGISTRY LAYER — after Memory Influence; before Priority Engine. ONLY active|validated assumptions may influence decisions.";

export const ASSUMPTION_REGISTRY_LAYER_FORBIDDEN = [
  "persist assumptions as memory truth",
  "merge into Care Profile identity",
  "store reasoning history or chat transcripts",
  "situation storage or knowledge graph nodes",
  "LLM prompt decoration with raw assumption statements as facts",
  "assumptions living forever without expiration",
  "invalidated or expired assumptions influencing decisions",
  "dedicated sidebar section for assumptions",
] as const;

export const ASSUMPTION_STATUSES = [
  "active",
  "validated",
  "invalidated",
  "expired",
] as const;

export const ASSUMPTION_SOURCES = [
  "user_input",
  "document",
  "inference",
  "system_default",
] as const;

/** Default expiration when never verified — assumptions must not live forever. */
export const DEFAULT_ASSUMPTION_EXPIRATION_DAYS = 90;

/** Stale threshold — active assumptions not verified within this window reduce decision quality. */
export const DEFAULT_ASSUMPTION_STALE_DAYS = 30;

/** Minimum confidence for inference-seeded assumptions. */
export const ASSUMPTION_INFERENCE_CONFIDENCE_THRESHOLD = 0.6;

/** Maximum soft bias applied to priority fusion from assumptions. */
export const ASSUMPTION_INFLUENCE_CAP = 0.25;
