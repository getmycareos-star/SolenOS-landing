/**
 * Baseline Comparison Engine — Architecture Directive #2.
 * SoT: docs/02-product/solenos-baseline-comparison-engine.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BASELINE_COMPARISON_PURPOSE,
  compareAgainstBaseline,
  inventsBaselineCausation,
  isFlatExtractionWithoutBaseline,
  orientationFromBaselineComparison,
} from "../src/lib/care-reality-intelligence";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import {
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity";

console.log("=== Baseline Comparison Engine ===\n");
console.log(BASELINE_COMPARISON_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-baseline-comparison-engine.md"),
  "utf8",
);
assert.ok(/What is different from before/i.test(sot));
assert.ok(/Previous Reality/i.test(sot));
assert.ok(/never invent causation|Never invent causation/i.test(sot));
assert.ok(/Baseline_State/i.test(sot));
console.log("✓ SoT present");

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "bce_mom_cook";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const dump = `
Mom used to cook every morning. For the past month she has stopped cooking and yesterday she left the house because she thought she needed to go to work.
  `.trim();

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T20:00:00.000Z",
  });

  const comparison = compareAgainstBaseline({
    situation: turn.situation,
    latestRawText: dump,
    careKey,
    person: "Mom",
    seedFromCapture: true,
  });

  assert.ok(comparison.has_baseline, "baseline reconstructed from used-to discourse");
  assert.ok(
    comparison.known_baseline.some((b) => /cook|morning|used to/i.test(b)),
    `known baseline held — got: ${comparison.known_baseline.join(" | ")}`,
  );
  assert.ok(comparison.has_meaningful_change, "meaningful changes detected");
  assert.ok(
    comparison.meaningful_changes.length >= 2,
    `expected ≥2 meaningful changes — got: ${comparison.meaningful_changes.join(" | ")}`,
  );
  assert.ok(
    comparison.meaningful_changes.some((c) => /familiar pattern|stopped|cook/i.test(c)),
    "activity cessation vs prior pattern",
  );
  assert.ok(
    comparison.meaningful_changes.some((c) => /safety|left (?:the )?(?:house|home)/i.test(c)),
    "safety-related leaving held as change",
  );
  assert.ok(comparison.unknowns.length >= 2, "timing/cause unknowns preserved");
  assert.equal(comparison.causation_forbidden, true);

  const orient = orientationFromBaselineComparison(comparison);
  assert.ok(orient.current_understanding, "orientation from comparison");
  assert.ok(
    /previous (?:routine|pattern)|two changes/i.test(orient.current_understanding!),
    `must speak change-from-baseline — got: ${orient.current_understanding!.slice(0, 300)}`,
  );
  assert.ok(!inventsBaselineCausation(orient.current_understanding!));

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: dump,
    kind: "general",
  });
  const blob = [
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.what_matters_now ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
    composed.confirmation,
  ].join(" ");

  assert.ok(
    !isFlatExtractionWithoutBaseline({
      blob,
      hasMeaningfulChange: true,
    }),
    `must not flat-extract without baseline language — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    /previous|usual|used to|familiar pattern|shift from|routine/i.test(blob),
    `composer must orient to change from previous — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(!inventsBaselineCausation(blob), "must not invent dementia causation");
  assert.ok(!/here are your tasks|you should contact|care summary/i.test(blob));
  console.log("✓ acceptance: used-to → stop + leave-home = change-from-baseline");
}

{
  // Cross-turn: establish baseline, then compare later observation
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "bce_cross_turn";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: "Mom usually walks around the house every morning and sleeps through the night.",
    kind: "general",
    nowIso: "2026-07-01T10:00:00.000Z",
  });

  const later = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: "For the past week she has stopped walking and is sleeping much more during the day.",
    kind: "general",
    nowIso: "2026-07-20T10:00:00.000Z",
  });

  const comparison = compareAgainstBaseline({
    situation: later.situation,
    latestRawText:
      "For the past week she has stopped walking and is sleeping much more during the day.",
    careKey,
    person: "Mom",
    seedFromCapture: true,
  });
  assert.ok(comparison.has_baseline, "prior baseline held");
  assert.ok(comparison.has_meaningful_change, "cross-turn change detected");
  assert.ok(!inventsBaselineCausation(JSON.stringify(comparison)));
  console.log("✓ cross-turn: prior usual → later change");
}

console.log("\nverify:baseline-comparison-engine OK");
