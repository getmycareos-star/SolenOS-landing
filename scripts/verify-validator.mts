import {
  SolenOSResponseSchema,
  gateForUI,
  isValidationError,
  validateAIResponse,
} from "../src/lib/response-validator";

const valid = {
  what_is_happening:
    "The caregiver reports that evening medication was missed, which creates uncertainty about whether today's dose schedule is intact.",
  what_matters_now:
    "Confirm whether the missed evening dose was taken because medication timing affects safety and next-step decisions.",
  what_to_ask_next: "Did she take the evening dose?",
  risk_level: "medium" as const,
  what_can_wait:
    "Insurance calls and scheduling can wait until medication status is confirmed.",
  follow_up_items: ["Confirm medication status"],
  decision_trace: {
    events: [],
    assumptions: [],
    unknowns: [],
    evidence_sources: [],
  },
  confidence_state: {
    overall_confidence: "low" as const,
    completeness: 0,
    reasoning_limits: ["Insufficient structured information to interpret safely."],
  },
  trust_layer: {
    known: [],
    assumed: [],
    unknown: [{ statement: "Insufficient structure to surface explicit gaps", drives_clarification: true }],
    recency: { last_updated_at: null, freshness_score: 0, interpretation: "potentially outdated (>7–14 days)" },
    confidence: 0.15,
  },
  transparency_panel: {
    data_used: { care_events: [], timeline_segments: [], caregiver_inputs: [] },
    data_ignored: { conflicting: [], low_confidence: [], stale_or_decayed: [] },
    reason_for_output: "Awaiting structured care input to produce traceable reasoning.",
    evidence_breakdown: [],
    confidence_scores: { overall_pct: 15, tier: "low" },
    recency: { last_update_at: null, critical_event_ages: [], decay_status: "stale" },
    observed: [],
    inferred: [],
  },
};

console.log("=== response-validator — Zod Hard Gate v1 ===\n");

const parsed = validateAIResponse(valid);
console.log("✓ valid payload accepted");
SolenOSResponseSchema.parse(parsed);

const gated = gateForUI(valid);
console.log("✓ gateForUI validates full contract via strict schema");
if (Object.keys(gated).length !== 10) {
  throw new Error(`gated output must have exactly 10 fields, got ${Object.keys(gated).length}`);
}

let rejected = false;
try {
  validateAIResponse({ ...valid, extra_field: "forbidden" });
} catch (e) {
  if (isValidationError(e)) {
    rejected = true;
    console.log("✓ extra fields rejected");
  }
}
if (!rejected) throw new Error("expected extra field rejection");

rejected = false;
try {
  validateAIResponse({ ...valid, follow_up_items: "not an array" });
} catch (e) {
  if (isValidationError(e)) {
    rejected = true;
    console.log("✓ non-array follow_up_items rejected");
  }
}
if (!rejected) throw new Error("expected non-array follow_up_items rejection");

const legacyRisk = validateAIResponse({ ...valid, risk_level: "MEDIUM" });
if (legacyRisk.risk_level !== "medium") {
  throw new Error("legacy uppercase risk_level must normalize to lowercase");
}
console.log("✓ legacy uppercase risk_level normalizes to lowercase");

rejected = false;
try {
  validateAIResponse({ ...valid, risk_level: "unknown" });
} catch (e) {
  if (isValidationError(e)) rejected = true;
  console.log("✓ invalid risk_level rejected");
}
if (!rejected) throw new Error("expected invalid risk rejection");

console.log("\n✓ response-validator hard gate verified");
