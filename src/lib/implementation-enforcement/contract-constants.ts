/** SolenOS — Implementation Enforcement Contract (canonical). */

export const IMPLEMENTATION_SYSTEM_IDENTITY =
  "A Living Care Record that preserves a person’s care journey over time through evidence-grounded, attributable and reviewable information.";

export const IMPLEMENTATION_SYSTEM_PURPOSE =
  "Maintain care continuity across observations, caregivers, appointments, documents, decisions and outcomes.";

export const IMPLEMENTATION_PRODUCT_MOAT =
  "Evidence-linked longitudinal care continuity with explicit uncertainty and provenance.";

export const IMPLEMENTATION_MOAT_FORBIDDEN = [
  "AI intelligence",
  "unsupported automation",
  "unattributed memory changes",
  "behavioral profiling",
  "engagement manipulation",
] as const;

export const IMPLEMENTATION_FORBIDDEN_IDENTITIES = [
  "chatbot",
  "AI assistant",
  "workflow platform",
  "AI doctor",
  "personalization engine",
  "memory system",
  "CRM",
  "healthcare SaaS platform",
] as const;

export const IMPLEMENTATION_PRIORITY_STACK = [
  "Safety and urgency escalation",
  "Grounding to available evidence",
  "Semantic role isolation",
  "Output schema compliance",
  "Readability and compression",
] as const;

export const IMPLEMENTATION_GROUNDING_PRINCIPLE = "No unsupported inference.";

export const IMPLEMENTATION_FAILURE_STATE_PRINCIPLE =
  "Graceful incompleteness is preferred over speculative clarity.";

export const IMPLEMENTATION_FINAL_PRODUCT_TRUTH =
  "Trust comes from deterministic structure, semantic stability, explicit uncertainty, and predictable cognitive decomposition — NOT from intelligence, personality, or conversation.";

export const IMPLEMENTATION_DATABASE_RECORD_FIELDS = [
  "interaction_id",
  "input_category",
  "output_structured",
  "structure_valid",
  "semantic_valid",
  "latency_ms",
  "risk_level",
  "relief_outcome",
  "requery_detected",
  "helpful_feedback",
] as const;

export const IMPLEMENTATION_OPTIMIZES_FOR = [
  "cognitive load reduction",
  "deterministic decomposition",
  "semantic role stability",
  "explicit uncertainty handling",
  "grounded interpretation",
  "immediate clarity",
] as const;

export const IMPLEMENTATION_DOES_NOT_OPTIMIZE_FOR = [
  "engagement",
  "personalization",
  "conversational quality",
  "assistant behavior",
  "intelligence display",
  "feature expansion",
] as const;
