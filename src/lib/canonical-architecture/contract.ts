/**
 * SolenOS Canonical Contracts — Cognitive Load Reduction Engine (final).
 */

/** Section 1 — immutable system identity. */
export const CANONICAL_SYSTEM_IDENTITY =
  "a deterministic cognitive decomposition engine that converts unstructured caregiver input into structured clarity under uncertainty";

export const CANONICAL_SYSTEM_PURPOSE =
  "Reduce cognitive burden during uncertainty through structured decomposition.";

export const CANONICAL_PRODUCT_MOAT =
  "Deterministic cognitive decompression under stress.";

/** Final implementation truth — stateless engine + relief validation layer only. */
export const CANONICAL_ONE_LINE_TRUTH =
  "Persistence exists to validate whether structured cognitive decomposition consistently reduces uncertainty. Persistence does NOT exist to understand, profile, predict, or optimize users.";

/** Modular monolith truth — aligned with system-architecture module. */
export const CANONICAL_MODULAR_MONOLITH_TRUTH =
  "SolenOS is a modular monolith — eight isolated domain modules in one deployable unit, not microservices, k8s, or a service mesh.";

/** PostgreSQL evidence ledger truth — aligned with postgres-contract module. */
export const CANONICAL_POSTGRES_TRUTH =
  "PostgreSQL stores interaction evidence, document extraction, grounding retrieval, and policy facts — never caregiver memory, longitudinal profiles, or behavioral analytics.";

export const CANONICAL_SEMANTIC_ROLE_TRUTH =
  "In SolenOS, clarity is created by separating meaning into strict, non-overlapping cognitive roles — not by adding intelligence or interpretation";

export const CANONICAL_SUCCESS_METRIC =
  "User cognitive load decreases immediately after output — instant understanding with no re-reading, no interpretation, and no mental effort to organize meaning.";

export const CANONICAL_PRIMARY_FAILURE_MODEL =
  "SolenOS fails when any inferred information appears, sections overlap in meaning, interpretation expands beyond input, prioritization includes reasoning, explanation leaks outside what_is_happening, or the system behaves conversationally.";

export const CANONICAL_CLARITY_PRINCIPLE =
  "Clarity over completeness. Structure over depth. Prioritization over explanation. Immediacy over intelligence display.";

export const CANONICAL_TRUST_PRINCIPLE =
  "Consistency is more important than quality variation.";

export const CANONICAL_CORE_PRINCIPLE =
  "ONLY what_is_happening may explain. All other fields hold a single semantic role with zero overlap.";

export const CANONICAL_DETERMINISTIC_FAILURE_MODEL =
  "SolenOS fails when identical or semantically equivalent inputs produce any meaningful output variation.";

/** @deprecated Use CANONICAL_DETERMINISTIC_FAILURE_MODEL */
export const CANONICAL_FAILURE_MODEL = CANONICAL_DETERMINISTIC_FAILURE_MODEL;

export const CANONICAL_GROUNDING_FAILURE_MODEL =
  "SolenOS fails when it produces any ungrounded or hallucinated content.";

export const CANONICAL_SYSTEM_PURPOSE_GOALS = [
  "reduce cognitive overload",
  "preserve uncertainty honestly",
  "structure chaotic information safely",
  "surface what matters",
  "expose missing information",
  "maintain deterministic interpretation behavior",
] as const;

/** @deprecated Use CANONICAL_SYSTEM_PURPOSE string */
export const CANONICAL_SYSTEM_PURPOSE_LIST = CANONICAL_SYSTEM_PURPOSE_GOALS;

export const CANONICAL_CHAOS_PROCESSING_PIPELINE = [
  "Surface extraction (ground only)",
  "Uncertainty tagging",
  "Contradiction preservation",
  "Structured transformation",
] as const;

/** Section 12 — fixed output model (5 fields only). */
export const CANONICAL_DISPLAY_SECTIONS = [
  { field: "what_is_happening", label: "WHAT IS HAPPENING" },
  { field: "what_matters_now", label: "WHAT MATTERS NOW" },
  { field: "what_to_ask_next", label: "WHAT TO ASK NEXT" },
  { field: "risk_level", label: "RISK LEVEL" },
  { field: "what_can_wait", label: "WHAT CAN WAIT" },
] as const;

export const CANONICAL_OUTPUT_FIELD_ORDER = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
] as const;

export const CANONICAL_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export const CANONICAL_DETERMINISTIC_VALIDATION_CHECKS = [
  "Repeated input test",
  "Structure drift check",
  "Priority stability check",
  "Interpretation stability check",
] as const;

/** Cognitive Load Reduction Engine — unified contract. */
export const CANONICAL_COGNITIVE_LOAD_IDENTITY = CANONICAL_SYSTEM_IDENTITY;

export const CANONICAL_COGNITIVE_LOAD_TRUTH = CANONICAL_ONE_LINE_TRUTH;

export const CANONICAL_COGNITIVE_LOAD_FAILURE_MODEL = CANONICAL_PRIMARY_FAILURE_MODEL;

export const CANONICAL_COGNITIVE_LOAD_SUCCESS =
  "User immediately understands what matters without thinking.";

export const CANONICAL_COGNITIVE_LOAD_KPI = [
  "no re-reading required",
  "no clarification needed",
  "instant prioritization recognition",
  "reduced cognitive load",
] as const;

export const CANONICAL_FORBIDDEN_IDENTITIES = [
  "chatbot",
  "conversational assistant",
  "reasoning agent",
  "predictive system",
  "knowledge generator",
  "narrative explainer",
  "retention system",
  "engagement system",
  "parser",
  "summarizer",
  "reasoning engine",
  "knowledge completion system",
  "narrative generator",
] as const;

/** @deprecated Use CANONICAL_FORBIDDEN_IDENTITIES */
export const CANONICAL_FORBIDDEN_IDENTITY = CANONICAL_FORBIDDEN_IDENTITIES;

/** Emotional acknowledgment lives in what_is_happening when distress is present — fixed schema only. */
export const CANONICAL_EMOTIONAL_IDENTITY =
  "brief emotional acknowledgment structurally contained within clarity fields when distress is present";

export const CANONICAL_EMOTIONAL_FAILURE_MODEL =
  "SolenOS fails when emotionally distressed input receives purely factual output, or when emotional acknowledgment becomes performative, excessive, or therapeutic.";

export const CANONICAL_EMOTIONAL_ACKNOWLEDGMENT_PRINCIPLE =
  "Emotional recognition without emotional simulation.";

export const CANONICAL_EMOTIONAL_PRODUCT_POSITION =
  "a structured emotional + cognitive stabilization layer for humans under uncertainty";

export const CANONICAL_EMOTIONAL_SUCCESS_CONDITION =
  "Grounded stabilization, not emotional attachment.";

export const CANONICAL_EMOTIONAL_RESPONSE_FLOW = [
  "Emotional signal detection",
  "Brief emotional stabilization in what_is_happening",
  "Structured interpretation",
  "Uncertainty preservation",
  "Clarification question in what_to_ask_next",
  "Safe prioritization",
] as const;

export const CANONICAL_CALIBRATED_UNCERTAINTY_IDENTITY =
  "calibrated clarity under uncertainty — not certainty, fear amplification, or ambiguity overload";

export const CANONICAL_CALIBRATED_UNCERTAINTY_FAILURE_MODEL =
  "SolenOS fails when users can reasonably interpret output as guaranteed safety, absence of concern, resolved uncertainty, or authoritative certainty.";

export const CANONICAL_CALIBRATED_UNCERTAINTY_BALANCE =
  "Calibrated clarity under uncertainty — not certainty, fear amplification, or ambiguity overload.";

export const CANONICAL_CALIBRATED_UNCERTAINTY_SUCCESS =
  "Useful prioritization without false safety or paralysis.";

export const CANONICAL_CALIBRATED_UNCERTAINTY_TRUTH =
  "SolenOS preserves uncertainty while still helping humans navigate ambiguity safely and usefully.";

export const CANONICAL_LOW_RISK_MEANING =
  'risk_level "low" = lower urgency based on current input — NOT safe or harmless.';

export const CANONICAL_COGNITIVE_CLARITY_IDENTITY =
  "cognitive load minimization as the sole success metric";

export const CANONICAL_COGNITIVE_CLARITY_EVALUATION =
  "How fast can a stressed human understand this without re-reading?";

export const CANONICAL_COGNITIVE_CLARITY_LOAD_FAILURE =
  "SolenOS fails when output requires re-reading, interpretation, or mental reorganization to understand what matters.";

export const CANONICAL_URGENCY_ESCALATION_IDENTITY =
  "urgency-aware prioritization with immediate action signals for high urgency";

export const CANONICAL_URGENCY_ESCALATION_ROLE =
  "Classify every input as low, medium, or high — escalate high urgency with minimal explanation layering.";

export const CANONICAL_URGENCY_ESCALATION_FAILURE_MODEL =
  "SolenOS fails when severe risk signals are not escalated clearly, urgency is diluted, or action is delayed.";

export const CANONICAL_URGENCY_SAFETY_PRINCIPLE =
  "Prevent escalation delay while preserving uncertainty — no diagnosis, no certainty claims.";

export const CANONICAL_HIGH_URGENCY_HEADER = "HIGH URGENCY / POSSIBLE EMERGENCY";

export const CANONICAL_NON_CONVERSATIONAL_IDENTITY =
  "a deterministic cognitive transformation engine with zero conversational behavior";

export const CANONICAL_NON_CONVERSATIONAL_PRINCIPLE = CANONICAL_CORE_PRINCIPLE;

export const CANONICAL_NON_CONVERSATIONAL_FAILURE_MODEL =
  "SolenOS fails when it behaves like a chatbot, introduces conversational tone, or simulates dialogue.";

export const CANONICAL_NON_CONVERSATIONAL_TRUTH =
  "SolenOS converts caregiver input into structured clarity blocks without dialogue, inference, or variation.";

export const CANONICAL_NON_CONVERSATIONAL_OUTPUT_ROLE =
  "INPUT → SURFACE EXTRACTION → UNCERTAINTY TAGGING → CONTRADICTION PRESERVATION → STRUCTURED OUTPUT";

export const CANONICAL_EPISODIC_RELIEF_IDENTITY =
  "single-shot cognitive relief with zero retention or engagement mechanics";

export const CANONICAL_EPISODIC_RELIEF_TRUTH =
  "SolenOS releases the user immediately after clarity — episodic activation only when new uncertainty appears.";

export const CANONICAL_EPISODIC_RELIEF_FAILURE_MODEL =
  "SolenOS fails when retention mechanics exist or the product becomes a platform users stay inside.";

export const CANONICAL_EPISODIC_RELIEF_SUCCESS = "I understand what matters now.";

export const CANONICAL_EPISODIC_RELIEF_DESIGN =
  "Designed to resolve cognitive overload and release the user immediately.";

export const CANONICAL_EPISODIC_TIME_TO_CLARITY = "Clarity in seconds, not sessions.";

export const CANONICAL_EPISODIC_PRODUCT_LOOP = [
  "Uncertainty trigger state",
  "Input dump state",
  "Cognitive decompression",
  "Relief moment",
  "Exit state",
] as const;

export const CANONICAL_EPISODIC_FORBIDDEN_SYSTEMS = [
  "dashboards",
  "tracking systems",
  "task managers",
  "workflow loops",
  "gamification",
  "habit formation",
  "retention mechanics",
  "multi-session design",
  "onboarding funnels",
] as const;

export const CANONICAL_CHAOS_TO_CLARITY_IDENTITY =
  "a deterministic chaos-to-structured-clarity transformation engine without inference or narrative completion";

export const CANONICAL_CHAOS_TO_CLARITY_TRUTH =
  "SolenOS transforms unstructured caregiver input into strictly grounded structured outputs while preserving uncertainty and refusing inference.";

export const CANONICAL_CHAOS_TO_CLARITY_FAILURE_MODEL =
  "SolenOS fails when it adds unstated facts, infers missing context, or constructs narrative coherence from fragments.";

export const CANONICAL_CHAOS_TO_CLARITY_PRINCIPLE =
  "Separate signal, noise, uncertainty, and missing information WITHOUT adding anything new.";

export const CANONICAL_CHAOS_TO_CLARITY_BEHAVIOR_MODEL =
  "INPUT (chaos) → SURFACE EXTRACTION → UNCERTAINTY TAGGING → CONTRADICTION PRESERVATION → STRUCTURED OUTPUT";

export const CANONICAL_CHAOS_TO_CLARITY_INPUT_ASSUMPTIONS = [
  "unstructured",
  "incomplete",
  "emotionally influenced",
  "potentially inconsistent",
  "partial signal + noise mix",
] as const;

export const CANONICAL_CHAOS_TO_CLARITY_PIPELINE = CANONICAL_CHAOS_PROCESSING_PIPELINE;

export const CANONICAL_CHAOS_TO_CLARITY_FORBIDDEN_IDENTITIES = [
  "parser",
  "summarizer",
  "reasoning engine",
  "knowledge completion system",
  "narrative generator",
] as const;

export const CANONICAL_FORBIDDEN_CONVERSATIONAL_LANGUAGE = [
  "Let me help",
  "Here's what I think",
  "I can help",
  "Sure",
  "Feel free to ask",
  "Hope this helps",
] as const;

export const CANONICAL_FORBIDDEN_GUARANTEE_LANGUAGE = [
  "Nothing to worry about",
  "This is harmless",
  "Everything is fine",
  "You should be okay",
  "This is not serious",
  "All clear",
] as const;

export const CANONICAL_CALIBRATED_SAFE_LANGUAGE = [
  "can sometimes occur in",
  "may warrant attention if",
  "this pattern may have multiple explanations",
  "monitoring changes may help clarify",
  "professional interpretation may still be needed",
] as const;

/** Section 15 — required validation pipeline (no shortcuts). */
export const CANONICAL_VALIDATION_PIPELINE = [
  "JSON schema validation",
  "Input grounding validation",
  "No-inference validation",
  "Semantic role isolation check",
  "Uncertainty separation check",
  "Urgency classification check",
  "Deterministic consistency check",
  "Cognitive load minimization check",
] as const;

export const CANONICAL_ARCHITECTURE_FLOW = [
  "Input normalization",
  "Document type tagging (organizational only)",
  "Structural extraction + signal prioritization",
  "Context window stabilization",
  "Structured transformation (Gemini envelope + fixed schema)",
  "JSON parse + Schema validation",
  "Input grounding validation",
  "No-inference validation",
  "Semantic role isolation check",
  "Uncertainty separation check",
  "Urgency classification check",
  "Document intake compliance gate",
  "Deterministic consistency gate",
  "Safety filter (Medical + Epistemic)",
  "Emotional acknowledgment validation",
  "Anti-guarantee check",
  "Cognitive load minimization check",
  "Non-conversational transformation check",
  "Episodic relief validation",
  "UI render",
] as const;

/** @deprecated Use CANONICAL_CHAOS_PROCESSING_PIPELINE */
export const CANONICAL_TRANSFORMATION_MODEL = [
  "Raw human input",
  "Signal extraction",
  "Priority structuring",
  "Uncertainty preservation",
  "Clarity reformulation",
  "Fixed output shape",
] as const;

/** @deprecated Removed from output — internal only if needed */
export const CANONICAL_META_FIELD_ORDER = [
  "context_completeness",
  "missing_critical_fact",
  "confidence",
] as const;

export const CANONICAL_FORBIDDEN_DETERMINISTIC_BEHAVIOR = [
  "change structure dynamically",
  "alter section order",
  "adapt reasoning strategy",
  "runtime reinterpretation",
  "probabilistic variation",
] as const;

export const CANONICAL_GENERALIZED_PATTERN_LABEL =
  "generalized non-authoritative pattern";

export const CANONICAL_GROUNDING_ALLOWED_PATTERNS = [
  "Cannot be determined from input",
  "Missing baseline prevents interpretation",
  "Multiple interpretations exist based on provided data",
  CANONICAL_GENERALIZED_PATTERN_LABEL,
] as const;

export const CANONICAL_FORBIDDEN_OPERATIONS = [
  "diagnose",
  "prescribe",
  "infer missing facts",
  "complete incomplete information",
  "generate hidden assumptions",
  "simulate expertise",
  "predict outcomes",
  "collapse ambiguity into certainty",
  "invent causal explanations",
  "replace professional judgment",
] as const;

/** @deprecated */
export const CANONICAL_FORBIDDEN_LANGUAGE = [
  "likely X is happening",
  "this confirms",
  "this is definitely",
  "this is normal",
  "this is the condition",
] as const;

/** @deprecated */
export const CANONICAL_REQUIRED_LANGUAGE = CANONICAL_GROUNDING_ALLOWED_PATTERNS;

/** @deprecated */
export const CANONICAL_CONFIDENCE_LEVELS = ["low", "medium", "high", "unknown"] as const;

/** Caregiver-first positioning — aligned with caregiver-first-positioning module. */
export const CANONICAL_CAREGIVER_FIRST_TRUTH =
  "Built for caregivers first — clarity, compression, and prioritization for reduced cognitive burden. NOT medical authority, institutional workflow optimization, or AI judgment.";
