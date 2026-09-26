/**
 * Understanding depth verification — the six capabilities that decide whether
 * SolenOS understands a care situation or only stores it.
 *
 *  1. Extraction never ends empty (model ladder + deterministic rule floor)
 *  2. Baseline reading is not single-regex (prior→now + quantity comparison)
 *  3. Contradictions are general, not dose-only, and preserve both accounts
 *  4. Caregiver capacity is understood and contained
 *  5. "What is understood" is never empty after a real capture
 *  6. Caregiver-legible standing + a visible, correctable "why"
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";

import { extractWithRules } from "../src/lib/semantic-extraction/rule-extractor";
import {
  mergeExtractions,
  normalizeExtraction,
  salvageJson,
  extractionCoverage,
} from "../src/lib/semantic-extraction/normalize";
import {
  readBaselineLanguage,
  quantityComparisons,
} from "../src/lib/care-reality-intelligence/baseline-language";
import {
  detectGeneralContradictions,
  detectWithinMessageContradictions,
} from "../src/lib/contradiction-detection-engine/general";
import {
  caregiverLoadProfile,
  caregiverCapacityLine,
  shouldDeferNewWork,
} from "../src/lib/caregiver-capacity/caregiver-load-signals";
import {
  buildUnderstandingTrace,
  caregiverStandingFor,
  shouldShowStanding,
  traceStepIsGrounded,
} from "../src/lib/care-clarity-projection";
import { looksLikeCareThread, threadFragmentCount } from "../src/lib/thread-ingestion/detect";
import type { CanonicalCareEvent } from "../src/lib/situation-entry/types";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

console.log("=== Understanding depth ===\n");

/* ------------------------------------------------------------------ */
console.log("— 1. extraction never ends empty —");

check("rule floor finds measurements, doses, times and questions", () => {
  const extraction = extractWithRules(
    "Her blood pressure was 138 over 86 this morning. She refused her evening metformin 500mg. " +
      "I honestly don't know if that's connected. Does this need the clinic today?",
  );
  assert.equal(extraction.schema_version, "1.0.0");
  const bp = extraction.measurements.find((m) => m.type === "blood_pressure");
  assert.ok(bp, "blood pressure should be extracted");
  assert.equal(bp?.systolic, 138);
  assert.equal(bp?.diastolic, 86);

  const med = extraction.medications[0];
  assert.ok(med, "medication should be extracted");
  assert.equal(med?.reported_action, "not_taken");

  assert.ok(extraction.questions.length > 0, "caregiver question should be captured");
  assert.ok(extraction.uncertainties.length > 0, "hedging should be preserved as uncertainty");
  assert.ok(extraction.observations.length > 0, "refusal should be an observation");
  assert.equal(extractionCoverage(extraction).has_structured_fact, true);
});

check("sleep, fluids, weight and appointment details survive extraction", () => {
  const extraction = extractWithRules(
    "He only slept 3 hours, drank 1 cup of tea, and weighs 168 lbs. Dr Smith appointment tomorrow at 10:30.",
  );
  assert.ok(extraction.measurements.some((m) => m.type === "sleep_hours" && m.value === 3));
  assert.ok(extraction.measurements.some((m) => m.type === "fluid_intake"));
  assert.ok(extraction.measurements.some((m) => m.type === "weight" && String(m.value) === "168"));
  const appt = extraction.appointments[0];
  assert.ok(appt, "appointment should be extracted");
  assert.equal(appt?.time, "10:30");
});

check("garbled model output is salvaged, not discarded", () => {
  const fenced = "```json\n{\"schema_version\":\"1.0.0\",\"observations\":[{\"description\":\"she refused breakfast\"}]}\n```";
  const salvaged = salvageJson(fenced);
  assert.ok(salvaged, "fenced JSON should be recoverable");
  const { extraction } = normalizeExtraction(salvaged);
  assert.ok(extraction, "partial extraction should still be usable");
  assert.equal(extraction?.observations.length, 1);
});

check("aliased and missing fields are repaired", () => {
  const { extraction, notes } = normalizeExtraction({
    symptoms: [{ text: "was confused all evening", type: "cognitive_change" }],
    meds: ["warfarin 5mg taken"],
  });
  assert.ok(extraction, "aliased payload should normalize");
  assert.equal(extraction?.observations.length, 1);
  assert.ok(notes.some((n) => n.startsWith("aliased_field")), "repairs should be reported");
});

check("merge keeps model findings and fills gaps from the rule floor", () => {
  const llm = normalizeExtraction({
    schema_version: "1.0.0",
    observations: [{ description: "confused in the evening", type: "cognitive_change" }],
    measurements: [],
    medications: [],
    temporal_facts: [],
    attributions: [],
    contradictions: [],
    uncertainties: [],
    questions: [],
    appointments: [],
    extraction_confidence: 0.7,
  }).extraction;
  const rules = extractWithRules("He took warfarin 5mg this morning but seemed confused.");
  const merged = mergeExtractions(llm, rules);
  assert.equal(merged.source, "llm+rules");
  assert.ok(merged.observations.some((o) => o.description.includes("confused")));
  assert.ok(merged.medications.length > 0, "rule-only medication finding must survive the merge");
  assert.equal(merged.degraded, false);
});

/* ------------------------------------------------------------------ */
console.log("\n— 2. baseline reading depth —");

check("'up until the fall … now …' reads as prior + change", () => {
  const reading = readBaselineLanguage(
    "Up until the fall in March he walked to the kitchen on his own. Now he needs the frame.",
  );
  assert.equal(reading.has_prior, true);
  assert.equal(reading.has_change, true);
  assert.ok(reading.baseline_statements[0]!.toLowerCase().includes("walked to the kitchen"));
  assert.ok(reading.pairs.length > 0, "prior/current pair should be formed");
});

check("'hasn't been himself since Tuesday' reads as change with onset", () => {
  const reading = readBaselineLanguage("He hasn't been himself since Tuesday and barely ate.");
  assert.equal(reading.has_change, true);
  assert.ok(reading.onset_statements.length > 0, "onset should be held");
});

check("quantity comparison catches a difference no cue word marks", () => {
  const comparisons = quantityComparisons("She slept 3 hours, where she usually does about 7.");
  assert.equal(comparisons.length, 1);
  assert.equal(comparisons[0]?.current, 3);
  assert.equal(comparisons[0]?.baseline, 7);
  assert.equal(comparisons[0]?.direction, "lower_than_usual");
  assert.ok(comparisons[0]?.difference_phrase.includes("4 hours less"));
});

check("explicit stability is preserved as evidence", () => {
  const reading = readBaselineLanguage("His walking is stable compared with last week, no change.");
  assert.ok(reading.stability_statements.length > 0);
  assert.ok(reading.stable_domains.length > 0);
});

check("no comparative language means no invented baseline", () => {
  const reading = readBaselineLanguage("He ate a slice of toast this morning.");
  assert.equal(reading.has_prior, false);
  assert.equal(reading.has_change, false);
  assert.equal(reading.quantity_comparisons.length, 0);
});

/* ------------------------------------------------------------------ */
console.log("\n— 3. general contradiction detection —");

function event(id: string, raw: string, timestamp: string): CanonicalCareEvent {
  return {
    id,
    raw_input: raw,
    extracted_type: "observation",
    entities: [],
    attributes: {},
    uncertainty: [],
    source: "user_input",
    root_event_id: null,
    situation_id: null,
    document_id: null,
    status: "committed",
    integrity: {} as CanonicalCareEvent["integrity"],
    priority: {} as CanonicalCareEvent["priority"],
    source_reliability: {} as CanonicalCareEvent["source_reliability"],
    timestamp,
  } as CanonicalCareEvent;
}

const DAY = "2026-09-26T";

check("medication taken vs missed is preserved, not resolved", () => {
  const { contradictions } = detectGeneralContradictions([
    event("e1", "I gave her the metformin 500mg with breakfast.", `${DAY}09:00:00.000Z`),
    event("e2", "My sister says she skipped the metformin this morning.", `${DAY}11:00:00.000Z`),
  ]);
  const med = contradictions.find((c) => c.field === "medication_action");
  assert.ok(med, "medication action conflict should be detected");
  assert.equal(med?.both_preserved, true);
  assert.ok(med?.shared_message.includes("Both are held"));
  assert.equal(med?.affects_safety, true);
});

check("conflicting doses are detected", () => {
  const { contradictions } = detectGeneralContradictions([
    event("e1", "The doctor changed his furosemide to 40mg a day.", `${DAY}08:00:00.000Z`),
    event("e2", "The pharmacy said his furosemide is 20mg a day.", `${DAY}09:30:00.000Z`),
  ]);
  assert.ok(contradictions.some((c) => c.field === "medication_dose"));
});

check("independence vs assistance is a contradiction, not a change", () => {
  const { contradictions } = detectGeneralContradictions([
    event("e1", "She walked to the bathroom on her own this morning.", `${DAY}10:00:00.000Z`),
    event("e2", "She needed two people to help her walk this morning.", `${DAY}14:00:00.000Z`),
  ]);
  assert.ok(contradictions.some((c) => c.field === "function"));
});

check("distant reports are changes, not contradictions", () => {
  const { contradictions } = detectGeneralContradictions([
    event("e1", "He walked to the kitchen on his own.", "2026-01-05T10:00:00.000Z"),
    event("e2", "He needed a walker to get around today.", "2026-09-26T10:00:00.000Z"),
  ]);
  assert.equal(contradictions.length, 0, "weeks apart is a change, not a contradiction");
});

check("agreeing accounts produce no noise", () => {
  const { contradictions } = detectGeneralContradictions([
    event("e1", "She took the morning tablets.", `${DAY}08:00:00.000Z`),
    event("e2", "She took her tablets this morning too.", `${DAY}09:00:00.000Z`),
  ]);
  assert.equal(contradictions.length, 0);
});

check("incompatible measurements in one day are flagged", () => {
  const { contradictions } = detectGeneralContradictions([
    event("e1", "His blood pressure was 118 over 74 this morning.", `${DAY}08:00:00.000Z`),
    event("e2", "His blood pressure was 186 over 112 this morning.", `${DAY}12:00:00.000Z`),
  ]);
  assert.ok(contradictions.some((c) => c.field === "measurement:blood_pressure"));
});

check("within-message contradictions are preserved", () => {
  const within = detectWithinMessageContradictions("She took the tablets. She didn't take the tablets.");
  assert.equal(within.length, 1);
  assert.equal(within[0]?.both_preserved, true);
});

/* ------------------------------------------------------------------ */
console.log("\n— 4. caregiver capacity —");

check("load is understood with evidence, not a shrug", () => {
  const profile = caregiverLoadProfile(
    "I haven't slept in three days and I'm doing this alone. My sister said she'll help next week.",
  );
  assert.ok(profile.signals.length >= 2);
  assert.ok(profile.signals.every((s) => s.evidence.length > 3), "every signal carries evidence");
  assert.equal(profile.has_care_content, false);
  assert.equal(shouldDeferNewWork(profile), true);
});

check("care content keeps a load note out of the emotional-only bucket", () => {
  const profile = caregiverLoadProfile("I am exhausted, but Mum fell this morning and needed help.");
  assert.ok(profile.signals.length > 0);
  assert.equal(profile.has_care_content, true);
  assert.equal(profile.load_only, false);
});

check("capacity line is non-judgmental and specific", () => {
  const profile = caregiverLoadProfile("I'm completely exhausted and doing this alone.");
  const line = caregiverCapacityLine(profile, 0);
  assert.ok(line);
  assert.ok(!/score|%\s|rating/i.test(line!), "no score theater in the capacity line");
});

check("no load signal keeps the existing gap-based relief line", () => {
  const line = caregiverCapacityLine(caregiverLoadProfile("The appointment is Tuesday."), 3);
  assert.ok(line?.includes("Several things"));
});

/* ------------------------------------------------------------------ */
console.log("\n— 5. long-thread ingestion —");

check("quoted reply pastes are recognised as threads", () => {
  const paste = [
    "> Can you take her to the appointment tomorrow?",
    "> She needs the paperwork from the surgery.",
    "Yes I can. I printed the discharge letter last night and it is in the folder on the counter.",
    "Thanks. I will pick her up at nine and we can go straight there after lunch.",
  ].join("\n");
  assert.equal(looksLikeCareThread(paste), true);
  assert.ok(threadFragmentCount(paste) >= 2);
});

check("a long single-blob paste is still recognised", () => {
  const paste =
    "She slept badly again last night and was up at three. In the morning she refused her breakfast entirely. " +
    "I got the district nurse to come and she checked her over and said she would come back tomorrow. " +
    "Later on Mum called twice to say she had left her own door open. I have not had a chance to eat anything. " +
    "The GP rang and left a message about the new prescription.";
  assert.equal(looksLikeCareThread(paste), true);
});

check("a short note stays a single observation", () => {
  assert.equal(looksLikeCareThread("She fell this morning."), false);
  assert.equal(threadFragmentCount("She fell this morning."), 1);
});

/* ------------------------------------------------------------------ */
console.log("\n— 6. caregiver-legible standing and visible why —");

check("trace quotes the caregiver and offers a correction", () => {
  const trace = buildUnderstandingTrace({
    facts: ["He refused his evening tablets."],
    quotes: ["dad refused his evening tablets again"],
    reporters: ["Dad"],
    dates: ["2026-09-26"],
    openQuestions: ["Whether the dose is still right"],
  });
  assert.equal(trace.steps.length, 1);
  assert.equal(trace.steps[0]?.source_quote, "dad refused his evening tablets again");
  assert.equal(trace.steps[0]?.when, "2026-09-26");
  assert.ok(trace.correction_prompt?.includes("tell us what was different"));
  assert.equal(trace.not_decided.length, 1);
  assert.equal(traceStepIsGrounded(trace.steps[0]!, ["dad refused his evening tablets again"]), true);
  assert.equal(
    traceStepIsGrounded(trace.steps[0]!, ["something completely different"]),
    false,
    "an ungrounded why must fail verification",
  );
});

check("trace never exposes engine vocabulary", () => {
  const trace = buildUnderstandingTrace({ facts: ["Walking needs help now."] });
  const blob = JSON.stringify(trace).toLowerCase();
  for (const banned of ["layer", "baseline_comparison", "dare", "pipeline", "score", "confidence"]) {
    assert.ok(!blob.includes(banned), `trace must not mention "${banned}"`);
  }
});

check("standing is composed from engine output, or stays silent", () => {
  const response = {
    contradiction_detection_layer: {
      open_contradictions: [
        {
          contradiction_id: "c1",
          field: "medication_action",
          event_ids: ["e1", "e2"],
          both_preserved: true as const,
          shared_message: "Two different records of whether metformin was taken.",
          affects_safety: true,
        },
      ],
    },
  } as never;

  const empty = caregiverStandingFor({
    response: {} as never,
    situationObservations: [],
    composed: null,
    latestRawText: "",
  });
  assert.equal(empty.has_content, false, "silence is allowed when nothing is known");

  const standing = caregiverStandingFor({
    response,
    situationObservations: [{ human_fact: "Mum needed help to walk this morning", raw_text: "mum needed help to walk" }],
    composed: { situation_summary: "Mobility has become harder this week." },
    latestRawText: "mum needed help to walk",
  });
  assert.equal(standing.has_content, true);
  assert.equal(standing.watch_for.length, 1);
  assert.ok(!/contradiction_detection_layer/.test(JSON.stringify(standing)), "no layer names");
});

check("standing respects progressive disclosure", () => {
  assert.equal(shouldShowStanding({ observationCount: 1, hasBaselineOrChange: false, stage: "early" }), false);
  assert.equal(shouldShowStanding({ observationCount: 3, hasBaselineOrChange: false, stage: "early" }), true);
  assert.equal(shouldShowStanding({ observationCount: 1, hasBaselineOrChange: true, stage: "growing" }), true);
  assert.equal(shouldShowStanding({ observationCount: 1, hasBaselineOrChange: false, stage: "early", crisis: true }), true);
});

console.log(`\n${passed} checks passed.`);
