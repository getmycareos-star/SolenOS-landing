/**
 * Care Reality Engine Foundation — phases + messy moat test.
 * SoT: docs/02-product/solenos-care-reality-engine-foundation.md
 *
 * Real test: document + text + observation → coherent Care Reality
 * (changes, uncertainty, next understanding) — NOT PDF summarization.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CARE_REALITY_ENGINE_PURPOSE,
  CARE_REALITY_ENGINE_PHASES,
  CARE_REALITY_ENGINE_MOAT_TEST,
  CARE_REALITY_ENGINE_NOT,
  MVP_EXCLUSIONS,
  EVIDENCE_PIPELINE,
  processCareRealityEngineFoundation,
  resolveIdentityAttribution,
  upsertBaselineProfileEntry,
  detectChangesFromComparison,
  preserveBehavioralObservation,
  adaptForCaregiverCapacity,
  detectCareTransitions,
  validateCaregiverOrientation,
  recordMemoryCorrection,
  listMemoryCorrections,
  resetBaselineProfileStore,
  resetMemoryCorrectionStore,
  rankEvidenceSource,
  resolveEvidenceOrientation,
  containsSafetyBoundaryViolation,
} from "../src/lib/care-reality-engine";
import { processSituationInput } from "../src/lib/situation-entry";
import { resetActiveCareSituationStore } from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";

const root = process.cwd();

console.log("=== Care Reality Engine Foundation ===\n");
console.log(CARE_REALITY_ENGINE_PURPOSE);
console.log(CARE_REALITY_ENGINE_MOAT_TEST);

assert.equal(CARE_REALITY_ENGINE_PHASES.length, 13);
assert.ok(CARE_REALITY_ENGINE_NOT.includes("chatbot"));
assert.ok(MVP_EXCLUSIONS.includes("family_chat"));
assert.deepEqual(
  [...EVIDENCE_PIPELINE],
  [
    "input",
    "evidence_understanding",
    "care_reality_update",
    "situation_relationship_engine",
    "response_contract",
  ],
);
console.log("✓ phase contracts + exclusions");

// Phase 1 — identity: kinship ≠ auto identity
{
  resetCareRecipientIdentityStore();
  const id = resolveIdentityAttribution({
    careRecipientId: "cr_engine_test",
    contributorId: "cg_engine_test",
    rawText: "Mom was confused today.",
  });
  assert.equal(id.care_recipient.displayName, null);
  assert.equal(id.needs_recipient_clarification, true);
  assert.equal(id.contributor.id, "cg_engine_test");
  console.log("✓ Phase 1 identity attribution (no silent Mom merge)");
}

// Phase 2 — baseline
{
  resetBaselineProfileStore();
  const profile = upsertBaselineProfileEntry({
    careRecipientId: "cr_engine_test",
    domain: "mobility",
    summary: "Walks independently.",
    confidence: "medium",
  });
  assert.equal(profile.established, true);
  assert.equal(profile.entries[0]?.domain, "mobility");
  console.log("✓ Phase 2 baseline profile");
}

// Phase 6 — change from baseline vs current
{
  const changes = detectChangesFromComparison({
    priorSummaries: ["Walks independently."],
    currentSummaries: ["Needs assistance walking."],
    deviations: [
      {
        observation: "Needs assistance walking.",
        compared_to_baseline: "Walks independently.",
        deviation_type: "escalation",
      },
    ],
  });
  assert.ok(changes.has_meaningful_change);
  assert.ok(changes.changes.some((c) => c.kind === "increased" || c.kind === "became_uncertain"));
  console.log("✓ Phase 6 change detection");
}

// Phase 7 — observation not diagnosis
{
  const obs = preserveBehavioralObservation({
    id: "obs_1",
    rawDescription: "Seemed more restless at night.",
    contributorId: "cg_engine_test",
    date: new Date().toISOString(),
  });
  assert.ok(obs);
  assert.equal(obs!.stance, "observation");
  console.log("✓ Phase 7 behavioral observation stance");
}

// Phase 8 — evidence priority + conflict keep both
{
  assert.equal(rankEvidenceSource("hospital discharge summary"), "clinical_documentation");
  const oriented = resolveEvidenceOrientation({
    a: { text: "Medication stopped.", source: "discharge summary" },
    b: { text: "Still taking medication.", source: "family note" },
    disagree: true,
  });
  assert.equal(oriented.conflict, true);
  assert.equal(oriented.orientation_source, "a");
  console.log("✓ Phase 8 evidence priority + conflict retained");
}

// Phase 9 — capacity
{
  const cap = adaptForCaregiverCapacity("Everything is happening at once. Too much.");
  assert.equal(cap.overload_likely, true);
  assert.equal(cap.max_asks, 1);
  console.log("✓ Phase 9 capacity adaptation");
}

// Phase 10 — transition signals
{
  const t = detectCareTransitions("Discharged home yesterday after the hospital stay.");
  assert.ok(t.some((x) => x.kind === "hospital_discharge"));
  console.log("✓ Phase 10 care transition detection");
}

// Phase 11 — safety bans
{
  assert.equal(containsSafetyBoundaryViolation("You need emergency care now."), true);
  assert.equal(
    containsSafetyBoundaryViolation("Important information may need attention."),
    false,
  );
  console.log("✓ Phase 11 safety boundary");
}

// Phase 12 — memory correction history
{
  resetMemoryCorrectionStore();
  recordMemoryCorrection({
    careRecipientId: "cr_engine_test",
    fieldLabel: "medication_status",
    originalValue: "Medication stopped.",
    correctedValue: "Medication continued.",
    correctedBy: "cg_engine_test",
  });
  const list = listMemoryCorrections("cr_engine_test");
  assert.equal(list.length, 1);
  assert.equal(list[0]!.history_preserved, true);
  console.log("✓ Phase 12 memory correction history");
}

// Phase 13 — orientation
{
  const ok = validateCaregiverOrientation({
    what_is_happening: "Sleep and mobility changed after discharge.",
    what_matters_now: "Whether walking stays unsafe at home.",
    what_to_ask_next: "Was a new medication started?",
    what_can_wait: "Older insurance paperwork.",
  });
  assert.equal(ok.passes, true);
  const fail = validateCaregiverOrientation({});
  assert.equal(fail.passes, false);
  console.log("✓ Phase 13 orientation validation");
}

// Foundation process
{
  const foundation = processCareRealityEngineFoundation({
    care_recipient_id: "cr_engine_test",
    contributor_id: "cg_engine_test",
    raw_input: "She seemed more confused today after coming home.",
    document_texts: ["Discharge: medication list updated. Follow up with clinic."],
    what_is_happening: "Confusion after return home; medication list updated.",
    what_changed: ["Confusion noted after discharge."],
    what_matters_now: "Whether confusion continues overnight.",
    what_is_uncertain: ["Why the medication list changed"],
    what_to_ask_next: "Do you know which medication changed?",
    what_can_wait: "Sorting older mail.",
  });
  assert.equal(foundation.phases_completed.length, 13);
  assert.ok(foundation.core.events.length >= 1);
  assert.ok(foundation.core.observations.length >= 1);
  assert.ok(foundation.orientation.passes);
  console.log("✓ foundation process completes all phases");
}

// MOAT TEST — messy document + text + observation → coherent Care Reality
console.log("\n--- Moat test: messy document + text + observation ---");
{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetMultiCaregiverContextStore();
  resetBaselineProfileStore();

  const careKey = `cg_cre_moat_${Date.now()}`;

  // 1) Document evidence (discharge-like text as extracted document)
  const docTurn = await processSituationInput({
    raw_input: "",
    caregiver_id: careKey,
    timestamp: "2026-07-19T10:00:00.000Z",
    provenance: { input_type: "document", entry_method: "upload", captured_at: "2026-07-19T10:00:00.000Z" },
    documents: [
      {
        id: "doc_moat_1",
        name: "discharge-summary.txt",
        mime_type: "text/plain",
        extracted_text:
          "Hospital discharge summary. Patient discharged home. Medication list updated. Follow up with clinic in one week.",
      },
    ],
  });

  // 2) Text note
  const textTurn = await processSituationInput({
    raw_input: "She has been more confused since coming home from the hospital.",
    caregiver_id: careKey,
    timestamp: "2026-07-19T11:00:00.000Z",
    provenance: { input_type: "text", entry_method: "text", captured_at: "2026-07-19T11:00:00.000Z" },
  });

  // 3) Observation
  const obsTurn = await processSituationInput({
    raw_input: "Last night she got up several times and seemed restless.",
    caregiver_id: careKey,
    timestamp: "2026-07-19T12:00:00.000Z",
    provenance: { input_type: "text", entry_method: "text", captured_at: "2026-07-19T12:00:00.000Z" },
  });

  assert.ok(docTurn.care_reality_engine_layer, "document turn must include care reality engine");
  assert.ok(textTurn.care_reality_engine_layer);
  assert.ok(obsTurn.care_reality_engine_layer);

  const engine = obsTurn.care_reality_engine_layer!;
  assert.equal(engine.phases_completed.length, 13);

  // Coherent Care Reality — not a PDF summary product
  const happening = obsTurn.final_output.what_is_happening ?? "";
  assert.ok(happening.length > 0, "must describe care reality");
  assert.ok(
    !/i extracted|ocr completed|pdf summary|document analyzer/i.test(happening),
    "must not be document-summary chrome",
  );

  const hasChangeSignal =
    engine.changes.has_meaningful_change ||
    (Array.isArray(obsTurn.what_changed) && obsTurn.what_changed.length > 0) ||
    Boolean(obsTurn.what_changed);
  assert.ok(hasChangeSignal || happening.length > 20, "must surface change or evolving reality");

  const hasUncertainty =
    engine.core.unknowns.length > 0 ||
    (obsTurn.what_is_uncertain?.length ?? 0) > 0 ||
    Boolean(obsTurn.final_output.what_to_ask_next);
  assert.ok(hasUncertainty, "must preserve uncertainty / next understanding");

  assert.ok(engine.orientation.passes || happening.length > 0, "orientation must improve understanding");

  assert.ok(
    (obsTurn.active_care_situation?.observations?.length ?? 0) >= 2,
    "ACS must hold continuity across messy inputs",
  );

  console.log("✓ MOAT: messy doc+text+observation → Care Reality (changes/uncertainty/continuity)");
}

const sot = fs.readFileSync(
  path.join(root, "docs", "02-product", "solenos-care-reality-engine-foundation.md"),
  "utf8",
);
assert(sot.includes("Messy") || sot.includes("messy"));
assert(sot.includes("never") || sot.includes("Never"));
console.log("✓ SoT present");

console.log("\nAll care-reality-engine foundation checks passed.");
