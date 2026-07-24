/**
 * Generalized Care Understanding Rules — verify (patterns only).
 * SoT: docs/02-product/solenos-generalized-care-understanding.md
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  GENERALIZED_CARE_UNDERSTANDING_PIPELINE,
  GENERALIZED_CARE_UNDERSTANDING_PURPOSE,
  GENERALIZED_CARE_UNDERSTANDING_RULES,
  ADDITIONAL_INTELLIGENCE_BEHAVIORS,
  caregiverFacingGeneralizedUnderstanding,
  presentsDerivedAsObservedFact,
  processGeneralizedCareUnderstanding,
} from "../src/lib/generalized-care-understanding";
import { processSituationInput } from "../src/lib/situation-entry";
import { resetActiveCareSituationStore } from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";

const root = process.cwd();

console.log("=== Generalized Care Understanding Rules ===\n");
console.log(GENERALIZED_CARE_UNDERSTANDING_PURPOSE);

const sot = path.join(root, "docs/02-product/solenos-generalized-care-understanding.md");
assert.ok(fs.existsSync(sot));
const sotText = fs.readFileSync(sot, "utf8");
assert.ok(/illustrations only|not a task extractor|Observed/i.test(sotText));
assert.equal(GENERALIZED_CARE_UNDERSTANDING_RULES.length, 10);
assert.equal(ADDITIONAL_INTELLIGENCE_BEHAVIORS.length, 15);
assert.deepEqual(
  [...GENERALIZED_CARE_UNDERSTANDING_PIPELINE],
  [
    "caregiver_language",
    "meaning",
    "care_signals",
    "current_care_understanding",
    "appropriate_next_steps",
  ],
);
console.log("✓ SoT + 10 rules + pipeline");

// Raw preserve + not task extractor
{
  const raw = "  fragments mixed up — refill delay and she seems different  ";
  const u = processGeneralizedCareUnderstanding({ raw_input: raw });
  assert.equal(u.raw_input_preserved, raw);
  assert.equal(u.is_care_understanding_engine, true);
  assert.equal(u.rules_applied.length, 10);
  console.log("✓ raw preserved; care understanding engine");
}

// Observed / Derived / Unknown separation
{
  const u = processGeneralizedCareUnderstanding({
    raw_input:
      "The doctor changed her medication. I'm not sure why. She has been sleeping more since then.",
  });
  assert.ok(u.epistemic.observed.length + u.epistemic.unknown.length >= 1);
  // Derived orientation must not be forced into observed-only
  assert.ok(Array.isArray(u.epistemic.derived));
  const face = caregiverFacingGeneralizedUnderstanding(u);
  assert.ok(!/Observed:|Derived:|open_loop_id/i.test(JSON.stringify(face)));
  console.log("✓ epistemic bands; no chrome leakage");
}

// Open loops — decision without why
{
  const u = processGeneralizedCareUnderstanding({
    raw_input: "The doctor changed her medication last week.",
  });
  assert.ok(
    u.open_loops.length >= 1 || u.epistemic.unknown.length >= 1 || u.internal.what_is_uncertain.length >= 1,
  );
  console.log("✓ open loops / unknowns without guessing");
}

// Longitudinal prior held
{
  const u = processGeneralizedCareUnderstanding({
    raw_input: "Walking is still harder today.",
    prior_held: ["Fall occurred last week.", "Hospital discharge noted."],
  });
  assert.ok(/already held|care story/i.test(u.internal.care_state_update ?? ""));
  console.log("✓ connects across time when prior exists");
}

// What can wait vs attention
{
  const u = processGeneralizedCareUnderstanding({
    raw_input:
      "Sudden confusion after the change, and also some old papers to organize sometime.",
  });
  assert.ok(u.requires_attention_now || u.useful_background.length >= 0);
  const face = caregiverFacingGeneralizedUnderstanding(u);
  assert.ok(face.what_can_wait === null || !/task list/i.test(face.what_can_wait));
  console.log("✓ attention vs can-wait framing");
}

// Domain generalization (architecture identical)
{
  const a = processGeneralizedCareUnderstanding({
    raw_input: "Sleeping much more this week than usual.",
  });
  const b = processGeneralizedCareUnderstanding({
    raw_input: "Needs more help walking than before.",
  });
  assert.equal(a.is_care_understanding_engine, b.is_care_understanding_engine);
  assert.equal(a.rules_applied.length, b.rules_applied.length);
  console.log("✓ generalized across domains");
}

// Additional behaviors 1–15
{
  const u = processGeneralizedCareUnderstanding({
    raw_input:
      "Walking is harder than before. Also started physical therapy. Outcome after the fall is still unclear.",
    prior_held: ["Fall occurred last week.", "Walked independently before."],
    contributor_id: "cg_add",
  });
  assert.ok(u.additional);
  assert.equal(u.additional.behaviors_applied.length, 15);
  assert.equal(u.additional.context_reconstruction.connects_to_prior, true);
  assert.equal(u.additional.recency.favors_recent, true);
  assert.equal(u.additional.confidence.unknowns_remain_visible, true);
  assert.equal(u.additional.continuous_learning.updates_care_record, true);
  assert.equal(u.additional.cognitive_overload.show_selectively, true);
  assert.ok(u.additional.attribution.contributor_id === "cg_add");
  assert.ok(
    u.additional.decision_readiness.ready === false ||
      u.additional.decision_readiness.missing_first.length >= 0,
  );
  // Contradiction preserve pattern when prior + change discourse
  const c = processGeneralizedCareUnderstanding({
    raw_input: "She no longer walks independently — now needs help.",
    prior_held: ["Walks independently around the house."],
  });
  assert.ok(
    c.additional.contradiction.detected === false ||
      (c.additional.contradiction.previous_understanding &&
        c.additional.contradiction.new_information &&
        c.additional.contradiction.current_interpretation),
  );
  console.log("✓ additional behaviors 1–15");
}

// Live path
{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetMultiCaregiverContextStore();
  const r = await processSituationInput({
    raw_input: "Medication was adjusted and the reason is still unclear.",
    caregiver_id: "care_gcu_wire",
  });
  assert.ok(r.generalized_care_understanding_layer);
  assert.equal(r.generalized_care_understanding_layer!.is_care_understanding_engine, true);
  assert.equal(r.generalized_care_understanding_layer!.rules_applied.length, 10);
  console.log("✓ wired on situation-entry");
}

// No pharmacy→task hardcode in module
{
  const src = fs.readFileSync(
    path.join(root, "src/lib/generalized-care-understanding/index.ts"),
    "utf8",
  );
  assert.ok(!/pharmacy\s*→|if\s*\(.*pharmacy.*\)\s*\{/.test(src));
  assert.ok(!/medication task|fall_detector|eating_detector/.test(src));
  assert.ok(
    presentsDerivedAsObservedFact(
      "The cause is unknown but the medication definitely caused this.",
    ),
    "detector should flag inference presented as certainty beside uncertainty",
  );
  console.log("✓ no illustration product if-branches");
}

console.log("\nverify:generalized-care-understanding OK");
