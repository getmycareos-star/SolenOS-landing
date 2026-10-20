/**
 * Internal Clinical Situation Classification — reasoning only.
 * SoT: docs/02-product/solenos-clinical-situation-classification.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLINICAL_SITUATION_CLASSIFICATION_PURPOSE,
  classifyClinicalSituations,
  containsClinicalCategoryLeakage,
  humanOrientationFromClinicalCategories,
  priorityForCategory,
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

console.log("=== Internal Clinical Situation Classification ===\n");
console.log(CLINICAL_SITUATION_CLASSIFICATION_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-clinical-situation-classification.md"),
  "utf8",
);
assert.ok(/Internal Clinical Situation Classification/i.test(sot));
assert.ok(/\*\*Never\*\* show|never show caregivers|reasoning only|engine-only/i.test(sot));
assert.ok(/Immediate Safety|Safety/i.test(sot));
console.log("✓ SoT present");
assert.equal(priorityForCategory("safety_concern"), 1);
assert.equal(priorityForCategory("functional_decline"), 2);
assert.ok(priorityForCategory("cognitive_change") < priorityForCategory("caregiver_strain"));
assert.ok(
  containsClinicalCategoryLeakage("Clinical category detected: Cognitive Change"),
);
assert.ok(containsClinicalCategoryLeakage("Risk score: 78%"));
assert.ok(containsClinicalCategoryLeakage("Patient declining"));
assert.ok(
  !containsClinicalCategoryLeakage(
    "Several changes appear to have happened around the same period.",
  ),
);
console.log("✓ Priority + leakage patterns");

{
  const multi =
    "Mom is sleeping more, confused, not eating, and medication changed.";
  const c = classifyClinicalSituations({ rawText: multi });
  assert.ok(c.primary.includes("sleep_change"), "sleep");
  assert.ok(c.primary.includes("cognitive_change"), "cognitive");
  assert.ok(c.primary.includes("nutrition_hydration_change"), "nutrition");
  assert.ok(c.primary.includes("medication_transition"), "medication");
  assert.equal(c.priority_focus, "cognitive_change"); // priority 3 before med 4 / sleep 5
  // Safety not present — cognitive is highest among hits (priority 3 vs 4/5)
  assert.ok(c.human_orientation);
  assert.ok(!containsClinicalCategoryLeakage(c.human_orientation!));
  assert.ok(
    /several changes|medication change|confusion|sleep|eating/i.test(c.human_orientation!),
  );
  assert.ok(c.links.length >= 1, "category relationships");
  console.log("✓ Multi-category compound capture");
}

{
  const safety =
    "Mom tried to leave the house at midnight because she thought she needed to go somewhere.";
  const c = classifyClinicalSituations({ rawText: safety });
  assert.ok(c.primary.includes("safety_concern"));
  assert.equal(c.priority_focus, "safety_concern");
  console.log("✓ Safety prioritizes");
}

{
  const family =
    "My sister thinks mom is fine because she only visits once a month.";
  const alone = classifyClinicalSituations({ rawText: family });
  assert.ok(alone.primary.includes("family_coordination") || alone.context.includes("family_coordination"));

  const withCare =
    "Mom keeps asking when dad is coming home, but he passed away years ago. My sister thinks mom is fine because she only visits once a month.";
  const mixed = classifyClinicalSituations({ rawText: withCare });
  assert.ok(mixed.primary.includes("cognitive_change"), "recipient primary");
  assert.ok(mixed.context.includes("family_coordination"), "family is context");
  assert.ok(
    !mixed.primary.includes("family_coordination"),
    "family must not replace recipient story",
  );
  assert.ok(
    /context|perspective/i.test(mixed.human_orientation ?? ""),
    "family held as context in human language",
  );
  console.log("✓ Family coordination as context");
}

{
  const med =
    "Her doctor stopped the medication after the hospital visit and now she sleeps more.";
  const c = classifyClinicalSituations({ rawText: med });
  assert.ok(c.primary.includes("medication_transition"));
  assert.ok(c.primary.includes("sleep_change"));
  assert.ok(
    c.links.some(
      (l) =>
        l.from === "medication_transition" && l.to === "sleep_change",
    ),
  );
  console.log("✓ Medication → sleep link");
}

{
  const human = humanOrientationFromClinicalCategories({
    primary: ["cognitive_change", "safety_concern", "medication_transition"],
    context: [],
    links: [
      {
        from: "medication_transition",
        to: "cognitive_change",
        certainty: "possible",
        note: "possible link",
      },
    ],
    priority_focus: "safety_concern",
  });
  assert.ok(human);
  assert.ok(!/Clinical category|Risk score|Patient declining/i.test(human!));
  assert.ok(/safety concern|confusion|medication/i.test(human!));
  console.log("✓ Human translation (no category chrome)");
}

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetCareRealityMemoryStore();

  const contributorId = "csc_multi";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const dump =
    "Mom is sleeping more, confused, not eating, and medication changed. My brother says I'm worrying too much.";

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T22:00:00.000Z",
  });

  const generated = generateActiveSituation({
    situation: turn.situation,
    latestRawText: dump,
    careKey,
    person: "Mom",
  });

  assert.ok(generated.clinical_classification.primary.length >= 3);
  assert.ok(
    generated.clinical_classification.context.includes("caregiver_strain") ||
      generated.clinical_classification.context.includes("family_coordination"),
  );
  assert.ok(generated.current_concern);
  assert.ok(!containsClinicalCategoryLeakage(generated.current_concern!));

  const orient = orientationFromGeneratedSituation(generated);
  assert.ok(orient.current_understanding);
  assert.ok(!containsClinicalCategoryLeakage(orient.current_understanding!));
  assert.ok(orient.what_changed);
  assert.ok(
    !/^Mom is sleeping more, confused/i.test(orient.what_changed!),
    "what_changed must not echo raw input",
  );
  assert.ok(!containsClinicalCategoryLeakage(orient.what_changed!));
  assert.ok(
    !containsClinicalCategoryLeakage(orient.connected_note ?? ""),
  );
  console.log("✓ Wired through situation generator (no UI leakage / no raw echo)");
}

{
  // Composer path — known-good multi-facet dump (no family distraction) must not leak categories
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetCareRealityMemoryStore();

  const contributorId = "csc_compose";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Dad" });

  const dump =
    "Dad has started forgetting where things are, he stopped enjoying his morning routine, and after his medication changed he seems more tired.";

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T22:05:00.000Z",
  });

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: dump,
    kind: "general",
  });
  const blob = [
    composed.recognition_line,
    composed.situation_summary,
    composed.what_changed,
    composed.what_matters_now,
    composed.connection_note,
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
  ]
    .filter(Boolean)
    .join("\n");
  assert.ok(!containsClinicalCategoryLeakage(blob), "composer must not leak categories");
  assert.ok(!/\bClinical category detected\b/i.test(blob));
  console.log("✓ Composer path: no clinical category chrome");
}

console.log("\nAll clinical situation classification checks passed.\n");
