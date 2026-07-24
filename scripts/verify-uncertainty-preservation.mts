/**
 * Uncertainty Preservation Engine — what happened vs why.
 * SoT: docs/02-product/solenos-uncertainty-preservation.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  UNCERTAINTY_PRESERVATION_PURPOSE,
  preserveUncertainty,
  containsCausalTheater,
  isStoredConclusionAsFact,
  validateUncertaintyPreservation,
  generateActiveSituation,
  orientationFromGeneratedSituation,
} from "../src/lib/care-reality-intelligence";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import {
  resetMultiCaregiverContextStore,
  resolveCareRealityStoreKey,
} from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import {
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity";
import { resetCareRealityMemoryStore } from "../src/lib/care-reality-intelligence";

console.log("=== Uncertainty Preservation Engine ===\n");
console.log(UNCERTAINTY_PRESERVATION_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-uncertainty-preservation.md"),
  "utf8",
);
assert.ok(/Uncertainty Preservation/i.test(sot));
assert.ok(/Correlation|cause/i.test(sot));
assert.ok(/Never store conclusions as facts/i.test(sot));
console.log("✓ SoT present");

assert.ok(containsCausalTheater("The medication caused Mom's increased sleep."));
assert.ok(containsCausalTheater("This is dementia progression."));
assert.ok(isStoredConclusionAsFact("Medication caused confusion"));
assert.ok(
  !containsCausalTheater(
    "Mom's increased sleeping happened around the same time as a medication change.",
  ),
);
console.log("✓ Causal theater detection");

{
  // Acceptance test — confusion after medication change
  const input = "Mom became confused after her medication changed.";
  const model = preserveUncertainty({ rawText: input, careRecipient: "Mom" });

  assert.ok(model.known.length >= 2, "observation + medication held as known");
  assert.equal(model.primary_cause_confidence, "low");
  assert.ok(
    model.known.every((k) => k.observation_confidence === "high"),
    "direct reports = high observation confidence",
  );
  assert.ok(model.possible_relationships.length >= 1);
  assert.ok(
    model.possible_relationships.every((p) => p.cause_confidence === "low"),
  );
  assert.ok(model.what_remains_unclear.length >= 2);
  assert.ok(model.human_orientation);
  assert.ok(!containsCausalTheater(model.human_orientation!));
  assert.ok(
    /confused|confusion/i.test(model.human_orientation!) &&
      /medication/i.test(model.human_orientation!) &&
      /unclear|may help|around the same|possible/i.test(model.human_orientation!),
  );
  assert.ok(
    !/medication caused confusion/i.test(model.human_orientation!),
    "must not claim cause",
  );

  const bad = validateUncertaintyPreservation({
    responseBlob: "The medication caused confusion.",
    model,
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.failures.includes("causal_theater"));

  const good = validateUncertaintyPreservation({
    responseBlob: model.human_orientation!,
    model,
    requireUncertaintyLanguage: true,
  });
  assert.equal(good.ok, true);
  console.log("✓ Acceptance: confusion after med change — uncertainty preserved");
}

{
  const sleep =
    "Mom has been sleeping more since her medication changed.";
  const model = preserveUncertainty({ rawText: sleep, careRecipient: "Mom" });
  assert.ok(model.human_orientation);
  assert.ok(!/medication (?:is )?causing|medication caused/i.test(model.human_orientation!));
  assert.ok(/around the same time|medication change/i.test(model.human_orientation!));
  console.log("✓ Sleep + med: timing held, cause not invented");
}

{
  const aggression = "My dad has become more aggressive.";
  const model = preserveUncertainty({ rawText: aggression, careRecipient: "Dad" });
  assert.ok(model.human_orientation);
  assert.ok(!/dementia progression/i.test(model.human_orientation!));
  assert.ok(
    /behavior|more context|possible factors/i.test(model.human_orientation!),
  );
  console.log("✓ Behavior change: no disease-progression theater");
}

{
  const multi =
    "Mom has been sleeping much more since leaving the hospital. They also changed her medication.";
  const model = preserveUncertainty({ rawText: multi, careRecipient: "Mom" });
  assert.ok(model.what_we_know.length >= 2);
  assert.ok(model.what_may_be_connected.length >= 1);
  assert.ok(model.what_remains_unclear.some((u) => /medication/i.test(u)));
  assert.ok(!containsCausalTheater(model.human_orientation ?? ""));
  console.log("✓ Known / possible / unknown structure");
}

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetCareRealityMemoryStore();

  const contributorId = "unc_accept";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const dump = "Mom became confused after her medication changed.";
  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T23:00:00.000Z",
  });

  const generated = generateActiveSituation({
    situation: turn.situation,
    latestRawText: dump,
    careKey,
    person: "Mom",
  });

  assert.equal(generated.confidence.cause, "low");
  assert.ok(generated.uncertainty_preservation.what_remains_unclear.length >= 1);
  assert.ok(generated.current_concern);
  assert.ok(!containsCausalTheater(generated.current_concern!));

  const orient = orientationFromGeneratedSituation(generated);
  assert.ok(orient.current_understanding);
  assert.ok(!containsCausalTheater(orient.current_understanding!));
  assert.ok(
    /medication/i.test(orient.current_understanding!) &&
      /unclear|may help|around the same|possible/i.test(
        orient.current_understanding!,
      ),
  );
  assert.ok(
    !/medication caused/i.test(orient.current_understanding!),
  );

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: dump,
    kind: "general",
  });
  const blob = [
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.connection_note ?? "",
    ...(composed.still_unclear ?? []),
    composed.confirmation,
  ].join(" ");
  assert.ok(!containsCausalTheater(blob), "composer must not invent cause");
  assert.ok(!/medication caused confusion/i.test(blob));
  console.log("✓ Wired through situation generator + composer");
}

console.log("\nAll uncertainty preservation checks passed.\n");
