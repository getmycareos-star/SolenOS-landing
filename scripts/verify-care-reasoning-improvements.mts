/**
 * Targeted validation for deep care reasoning improvements.
 *
 * Tests:
 * 1. Semantic change detection (NEW/WORSENED/IMPROVED/etc)
 * 2. Compound signal recognition
 * 3. Baseline trajectory tracking
 * 4. Progressive understanding trajectory_by_domain
 * 5. Care Reality State enrichment
 */

import { detectCareStateChanges } from "../src/lib/care-state-change-detector";
import { deriveBaselineFacts, detectDeviations } from "../src/lib/baseline-intelligence-engine/derive-baseline";
import { processProgressiveUnderstanding } from "../src/lib/progressive-understanding/process";
import { updateCareRealityState } from "../src/lib/care-reality-state/process";
import type { CanonicalCareEvent, CareContextRoot } from "../src/lib/situation-entry/types";

function makeEvent(
  rawInput: string,
  id: string,
  overrides: Partial<CanonicalCareEvent> = {},
): CanonicalCareEvent {
  const now = new Date().toISOString();
  return {
    id,
    timestamp: now,
    event_time: { start: now, end: null, label: null },
    ingestion_time: now,
    raw_input: rawInput,
    extracted_type: "observation",
    entities: [],
    attributes: {},
    uncertainty: [],
    source: "user_input",
    root_event_id: null,
    situation_id: null,
    document_id: null,
    status: "committed",
    integrity: { superseded_by_id: null, invalidated_by_id: null, confidence: 1, audit: [] },
    priority: { score: 0, rank: 0, attention: false },
    ...overrides,
  };
}

function makeContext(events: CanonicalCareEvent[]): CareContextRoot {
  const now = new Date().toISOString();
  return {
    id: "CareContextRoot",
    care_recipient_id: "test_recipient",
    caregiver_id: "test_caregiver",
    events,
    root_event_id: events[0]?.id ?? null,
    created_at: now,
    updated_at: now,
    multi_caregiver: { contributors: [], shared_reality: { active_risks: [], confidence_map: {} } },
  };
}

console.log("=== TEST 1: Semantic Change Detection — WORSENED + Compound ===");
const priorEvents1 = [
  makeEvent("She sleeps well.", "e1", { ingestion_time: new Date(Date.now() - 86400000 * 3).toISOString() }),
  makeEvent("She eats normally.", "e2", { ingestion_time: new Date(Date.now() - 86400000 * 2).toISOString() }),
  makeEvent("She seems happy.", "e3", { ingestion_time: new Date(Date.now() - 86400000 * 1).toISOString() }),
];
const newEvents1 = [
  makeEvent("She is not eating.", "e4"),
  makeEvent("She seems confused.", "e5"),
  makeEvent("She fell.", "e6"),
];
const report1 = detectCareStateChanges({
  priorContext: makeContext(priorEvents1),
  currentContext: makeContext([...priorEvents1, ...newEvents1]),
  eventsCreated: newEvents1,
  baselineFacts: [],
  baselineDeviations: [],
});

console.log(`Has meaningful change: ${report1.has_meaningful_change}`);
console.log(`Primary changes: ${report1.primary_changes.map(c => `${c.classification}:${c.domain}`).join(", ")}`);
console.log(`Compound signals: ${report1.compound_signals.join("; ")}`);
console.log(`Attention required: ${report1.attention_required}`);
console.log(`Trajectory: ${report1.trajectory_summary}`);

const expectedWorsened = report1.primary_changes.some(c => c.classification === "WORSENED");
const expectedCompound = report1.compound_signals.length > 0;
console.log(`Expected WORSENED changes present: ${expectedWorsened}`);
console.log(`Expected compound signals present: ${expectedCompound}`);

console.log("\n=== TEST 2: Improvement Detection ===");
const priorEvents2 = [
  makeEvent("She was very confused and agitated.", "e4", { ingestion_time: new Date(Date.now() - 86400000 * 2).toISOString() }),
  makeEvent("She was not eating.", "e5", { ingestion_time: new Date(Date.now() - 86400000 * 1).toISOString() }),
];
const newEvents2 = [
  makeEvent("She is much better. Calm, eating well, and seems like her old self.", "e6"),
];
const report2 = detectCareStateChanges({
  priorContext: makeContext(priorEvents2),
  currentContext: makeContext([...priorEvents2, ...newEvents2]),
  eventsCreated: newEvents2,
  baselineFacts: [],
  baselineDeviations: [],
});

console.log(`Has meaningful change: ${report2.has_meaningful_change}`);
console.log(`Primary changes: ${report2.primary_changes.map(c => `${c.classification}:${c.domain}`).join(", ")}`);
const expectedImproved = report2.primary_changes.some(c => c.classification === "IMPROVED");
console.log(`Expected IMPROVED changes present: ${expectedImproved}`);

console.log("\n=== TEST 3: Baseline Trajectory Tracking ===");
const baselineEvents = [
  makeEvent("She is repeating questions.", "b1", { ingestion_time: new Date(Date.now() - 86400000 * 10).toISOString() }),
  makeEvent("She is repeating questions more.", "b2", { ingestion_time: new Date(Date.now() - 86400000 * 5).toISOString() }),
  makeEvent("She keeps repeating questions and worsening.", "b3", { ingestion_time: new Date(Date.now() - 86400000 * 2).toISOString() }),
];
const baselineFacts = deriveBaselineFacts(baselineEvents);
console.log(`Baseline facts: ${baselineFacts.map(f => `${f.domain}:${f.trajectory}`).join(", ")}`);
const communicationBaseline = baselineFacts.find(f => f.domain === "communication");
console.log(`Communication baseline established: ${communicationBaseline !== undefined}`);
console.log(`Communication baseline confidence: ${communicationBaseline?.confidence}`);
console.log(`Communication baseline trajectory: ${communicationBaseline?.trajectory}`);

console.log("\n=== TEST 4: Progressive Understanding Compound Signal + Trajectory ===");
const priorObs = [
  { raw_text: "She seems more confused today.", kind: "general" as const, captured_at: new Date(Date.now() - 86400000).toISOString(), human_fact: "She seems more confused today." },
  { raw_text: "She is agitated and not sleeping.", kind: "general" as const, captured_at: new Date(Date.now() - 3600000 * 12).toISOString(), human_fact: "She is agitated and not sleeping." },
];
const latestObs = { raw_text: "She fell again this morning and seems much worse.", kind: "fall" as const, captured_at: new Date().toISOString(), human_fact: "She fell again this morning." };
const draft = {
  id: "acs1",
  care_recipient_id: "test",
  caregiver_id: "test",
  opened_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  root_event_id: "e1",
  subject_label: "Mom",
  theme: "emotional_behavior" as const,
  observations: [...priorObs, latestObs],
  open_questions: [],
  asked_questions: [],
  understanding_stage: "gathering" as const,
  connection_note: null,
  synthesis: null,
  what_matters_now: null,
  last_understanding_effect: null,
  last_understanding_delta: null,
  pattern_label: null,
  familiarity_baseline: [],
};

const progressive = processProgressiveUnderstanding({
  prior: { ...draft, observations: priorObs },
  relation: "updates_active",
  observation: latestObs,
  kind: "fall",
  rawText: latestObs.raw_text,
  draft,
});

console.log(`Compound signal: ${progressive.compound_signal}`);
console.log(`Trajectory by domain: ${JSON.stringify(progressive.trajectory_by_domain)}`);
console.log(`Pattern label: ${progressive.pattern_label}`);
console.log(`Understanding stage: ${progressive.understanding_stage}`);

console.log("\n=== TEST 5: Care Reality State Enrichment ===");
const crs = updateCareRealityState({
  caregiverId: "test_recipient",
  turn: {
    ...progressive,
    situation: draft,
    relation: "updates_active",
    what_changed_in_understanding: "WORSENED: multiple domains — compound signal detected",
    pattern_label: progressive.pattern_label,
    resolved_uncertainties: [],
    compound_signal: progressive.compound_signal,
    trajectory_by_domain: progressive.trajectory_by_domain,
  } as any,
  situation: draft,
  relation: "updates_active",
});
console.log(`CRS compound_signals: ${crs.compound_signals.join("; ")}`);
console.log(`CRS care_domain_trajectories: ${JSON.stringify(crs.care_domain_trajectories)}`);
console.log(`CRS change_classifications: ${crs.change_classifications.join(", ")}`);
const expectedCrsEnriched = crs.compound_signals.length > 0 && Object.keys(crs.care_domain_trajectories).length > 0;
console.log(`CRS enriched with structured state: ${expectedCrsEnriched}`);

console.log("\n=== VALIDATION SUMMARY ===");
const allPassed = expectedWorsened && expectedCompound && expectedImproved && expectedCrsEnriched && progressive.compound_signal !== null;
console.log(`All checks passed: ${allPassed}`);
if (!allPassed) {
  console.log("FAILED CHECKS:");
  if (!expectedWorsened) console.log("  - WORSENED changes not detected");
  if (!expectedCompound) console.log("  - Compound signals not detected");
  if (!expectedImproved) console.log("  - IMPROVED changes not detected");
  if (!expectedCrsEnriched) console.log("  - CRS not enriched with structured state");
  if (progressive.compound_signal === null) console.log("  - Compound signal not detected in progressive understanding");
  process.exit(1);
} else {
  console.log("All deep care reasoning improvements validated successfully.");
}
