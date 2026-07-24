/**
 * Care Situation Understanding — meaning before caregiver language.
 *
 * Raw input (text / OCR from Scan·Snap·Upload·Share) → typed care reality →
 * prioritize → memory hooks → Response Contract projection.
 *
 * Instant-value rule: sync deterministic path must orient on first capture.
 * Optional LLM enrichment never blocks first orientation (fail-closed).
 *
 * Doc examples / golden fixtures = evaluation only — never product if-branches.
 */

export const CARE_SITUATION_UNDERSTANDING_PURPOSE =
  "Transform messy caregiver input into structured care understanding before responding — never summarize.";

export const INSTANT_VALUE_RULE =
  "First capture must make the situation clearer in one glance (~30s). No setup homework. No waiting on enrichment to orient.";

export type CareSituationFactKind =
  | "event"
  | "observation"
  | "decision"
  | "outcome";

export type CareSituationFact = {
  kind: CareSituationFactKind;
  text: string;
  /** Engine-only — never expose */
  source_fragment?: string;
};

export type CareSituationInterpretation = {
  text: string;
  /** Why this is not stored as fact */
  reason: "caregiver_interpretation" | "recipient_self_report_uncertain" | "possible_link";
};

export type CareSituationPossibleLink = {
  text: string;
  /** Always non-causal */
  causation_claimed: false;
};

export type CareSituationUnderstanding = {
  care_recipient: string | null;
  /** Directly evidenced */
  facts: CareSituationFact[];
  /** Marked non-fact */
  interpretations: CareSituationInterpretation[];
  unknowns: string[];
  possible_links: CareSituationPossibleLink[];
  changes_from_baseline: string[];
  /** Highest impact first — orientation, not task list */
  matters_now: string[];
  /** Important but not first */
  can_wait: string[];
  /** Max 1–3; each closes an unknown */
  follow_up_questions: string[];
  /** Contributor load / grief / family coordination — context only */
  context_only: string[];
  /** What future captures should reconnect to */
  continuity_hooks: string[];
  /** True when this pass can orient a tired caregiver */
  can_orient: boolean;
  /** Instant-value: produced without waiting on LLM */
  instant_path: true;
  /** Engine confidence band — never % in UI */
  confidence: "low" | "medium" | "high";
};
