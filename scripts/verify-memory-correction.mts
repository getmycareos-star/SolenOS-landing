/**
 * Slice 2.4 — Memory correction ingest wire.
 * Explicit correction updates belief; prior kept as disputed evidence.
 * Principle-based discourse cues — not scenario noun templates.
 * Same ingest path for text and document kinds (Input Entry Contract).
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { getCareRealityState, resetCareRealityStateStore } from "../src/lib/care-reality-state";
import {
  listMemoryCorrections,
  looksLikeExplicitMemoryCorrection,
  findCorrectionTargetObservation,
  resetMemoryCorrectionStore,
} from "../src/lib/care-reality-engine";
import { resetMultiCaregiverContextStore, resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import {
  resetCareRecipientIdentityStore,
  setCareRecipientDisplayName,
} from "../src/lib/care-recipient-identity";

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMemoryCorrectionStore();
  resetMultiCaregiverContextStore();
  resetCareRecipientIdentityStore();
}

console.log("=== Memory correction ingest (Slice 2.4) ===\n");

// Detector is discourse-structural, not topic-locked
assert.equal(
  looksLikeExplicitMemoryCorrection("That's wrong — she didn't fall"),
  true,
);
assert.equal(
  looksLikeExplicitMemoryCorrection("Correction: he never left the house alone"),
  true,
);
assert.equal(
  looksLikeExplicitMemoryCorrection("She seemed quieter after lunch"),
  false,
);
console.log("✓ explicit correction cues are structural (any topic)");

// Illustration A — spine Done-when wording (not product hardcoding)
{
  resetAll();
  const careKey = "mc_slice24_a";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway yesterday afternoon.",
    kind: "general",
    nowIso: "2026-07-20T10:00:00.000Z",
  });
  const prior = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "That's wrong — she didn't fall",
    kind: "general",
    nowIso: "2026-07-20T10:05:00.000Z",
  });

  assert.equal(prior.memory_correction_applied, true);
  assert.equal(prior.relation, "updates_active");
  const disputed = prior.situation.observations.find((o) => o.disputed_by_correction_id);
  const correctionObs = prior.situation.observations.find((o) => o.corrects_observation_id);
  assert.ok(disputed, "prior observation marked disputed");
  assert.ok(correctionObs, "correction observation linked");
  assert.equal(correctionObs!.corrects_observation_id, disputed!.id);
  assert.match(correctionObs!.human_fact.toLowerCase(), /didn'?t fall|she didn'?t fall/i);

  const crs = getCareRealityState(careKey);
  assert.ok(crs);
  assert.equal(crs!.response_evolution.invalidates_previous_understanding, true);
  const evidenceBlob = crs!.supporting_evidence.map((e) => e.observation).join(" | ");
  assert.match(evidenceBlob, /Correction:/i);
  assert.match(evidenceBlob, /Prior \(disputed/i);
  assert.ok(
    crs!.current_understanding.some((l) => /didn'?t fall/i.test(l)),
    "CRS understanding prefers corrected claim",
  );
  assert.ok(
    !crs!.current_understanding.some((l) =>
      /fell in the hallway/i.test(l) && !/didn'?t|disputed/i.test(l),
    ),
    "disputed fall claim not still primary understanding",
  );

  const records = listMemoryCorrections(careKey);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.history_preserved, true);
  assert.match(records[0]!.original_value.toLowerCase(), /fell|hallway/);
  console.log("✓ text correction updates belief + keeps disputed prior");
}

// Illustration B — different topic (proves no fall-only wiring)
{
  resetAll();
  const careKey = "mc_slice24_b";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "He refused the evening medication.",
    kind: "general",
    nowIso: "2026-07-20T11:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Actually he didn't refuse — he took it later.",
    kind: "general",
    nowIso: "2026-07-20T11:05:00.000Z",
  });
  assert.equal(turn.memory_correction_applied, true);
  assert.ok(turn.situation.observations.some((o) => o.disputed_by_correction_id));
  assert.ok(
    turn.current_understanding.some((l) => /didn'?t refuse|took it later/i.test(l)),
  );
  console.log("✓ correction works for non-fall topics (principle-based)");
}

// Document kind — same ingest call site (Scan/Snap/Upload/Share → document/text ACS)
{
  resetAll();
  const careKey = "mc_slice24_doc";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Discharge note: patient wandered overnight.",
    kind: "document",
    nowIso: "2026-07-20T12:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "That's not right — she never wandered.",
    kind: "document",
    nowIso: "2026-07-20T12:05:00.000Z",
  });
  assert.equal(turn.memory_correction_applied, true);
  const target = findCorrectionTargetObservation(turn.situation, "That's not right — she never wandered.");
  // After correction, target is already disputed; find on pre-correction ACS is enough via applied flag
  assert.ok(turn.situation.observations.some((o) => o.disputed_by_correction_id));
  assert.ok(listMemoryCorrections(careKey).length >= 1);
  console.log("✓ document-kind correction uses same ingest wire");
}

// No prior ACS → no correction theater
{
  resetAll();
  const careKey = "mc_slice24_empty";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "That's wrong — she didn't fall",
    kind: "general",
    nowIso: "2026-07-20T13:00:00.000Z",
  });
  assert.notEqual(turn.memory_correction_applied, true);
  assert.equal(listMemoryCorrections(careKey).length, 0);
  console.log("✓ no ACS → normal observation (no fake correction)");
}

// Composer surfaces correction (not gather-hidden)
{
  resetAll();
  const careKey = "mc_slice24_compose";
  setCareRecipientDisplayName({
    careKey: resolveCareRealityStoreKey(careKey),
    displayName: "Mom",
  });
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway yesterday afternoon.",
    kind: "general",
    nowIso: "2026-07-20T14:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "That's wrong — she didn't fall",
    kind: "general",
    nowIso: "2026-07-20T14:05:00.000Z",
  });
  assert.equal(turn.memory_correction_applied, true);
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "That's wrong — she didn't fall",
    kind: "general",
    hasDocuments: false,
  });
  assert.ok(
    composed.what_changed && /corrected|disputed/i.test(composed.what_changed),
    "composer must surface correction what_changed",
  );
  const blob = [
    ...composed.what_we_know,
    composed.situation_summary ?? "",
    composed.what_is_happening ?? "",
  ].join(" ");
  assert.ok(
    /didn'?t fall/i.test(blob),
    "composer understanding prefers corrected claim",
  );
  console.log("✓ composer surfaces memory correction to caregiver");
}

console.log("\nverify:memory-correction OK");
