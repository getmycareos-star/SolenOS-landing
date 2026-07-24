/**
 * Care Signal Understanding — pattern tests (illustrations only).
 * SoT: docs/02-product/solenos-care-signal-understanding.md
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CARE_SIGNAL_UNDERSTANDING_PIPELINE,
  CARE_SIGNAL_UNDERSTANDING_PURPOSE,
  CARE_SIGNAL_UNDERSTANDING_REJECTS,
  containsCareSignalUiLeakage,
  caregiverFacingCareSignalUnderstanding,
  preserveRawCaregiverInput,
  processCareSignalUnderstanding,
} from "../src/lib/care-signal-understanding";
import { processSituationInput } from "../src/lib/situation-entry";
import { resetActiveCareSituationStore } from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";

const root = process.cwd();

console.log("=== Care Signal Understanding Layer ===\n");
console.log(CARE_SIGNAL_UNDERSTANDING_PURPOSE);

const sot = path.join(root, "docs/02-product/solenos-care-signal-understanding.md");
assert.ok(fs.existsSync(sot));
const sotText = fs.readFileSync(sot, "utf8");
assert.ok(/illustrations only|Never.*task list|Caregiver input → Care signals/i.test(sotText));
assert.deepEqual(
  [...CARE_SIGNAL_UNDERSTANDING_PIPELINE],
  [
    "preserve_raw_input",
    "infer_care_signals",
    "update_care_state_understanding",
    "what_matters_now",
    "missing_context",
  ],
);
assert.ok(CARE_SIGNAL_UNDERSTANDING_REJECTS.includes("input_to_task_checklist"));
console.log("✓ SoT + pipeline contract");

// Raw preserve — exact, including messy spacing
{
  const messy = "  she was weird idk  \nmaybe worse today  ";
  assert.equal(preserveRawCaregiverInput(messy), messy);
  const u = processCareSignalUnderstanding({ raw_input: messy });
  assert.equal(u.raw_input_preserved, messy);
  assert.equal(u.rejects_task_pipeline, true);
  console.log("✓ raw input preserved exactly");
}

// Meaning over tasks — medical-ish fragment (illustration)
{
  const u = processCareSignalUnderstanding({
    raw_input:
      "The pharmacy said the refill is delayed and blood pressure has been higher this week. Not sure why they are checking it daily.",
  });
  assert.ok(u.known.length + u.uncertain.length >= 1);
  assert.ok(u.care_state_understanding || u.what_matters_now);
  const face = caregiverFacingCareSignalUnderstanding(u);
  assert.ok(!containsCareSignalUiLeakage(JSON.stringify(face)));
  assert.ok(!/task list|things to do:/i.test(JSON.stringify(face)));
  console.log("✓ care-state understanding (not checklist)");
}

// Domain generalization — sleep / walking substitutes must work the same architecture
{
  const a = processCareSignalUnderstanding({
    raw_input: "Sleeping much more this week and I'm not sure if it started after something changed.",
  });
  const b = processCareSignalUnderstanding({
    raw_input: "Needs more help walking to the bathroom than before.",
  });
  assert.ok(a.rejects_task_pipeline && b.rejects_task_pipeline);
  assert.ok(a.raw_input_preserved.includes("Sleeping"));
  assert.ok(b.raw_input_preserved.includes("walking"));
  console.log("✓ generalized across domains (no scenario hardcode required)");
}

// Emotion / load — no burnout score
{
  const u = processCareSignalUnderstanding({
    raw_input: "I'm exhausted keeping track of everything and I don't know what matters.",
  });
  const blob = JSON.stringify(caregiverFacingCareSignalUnderstanding(u));
  assert.ok(!/burnout score|\d{2,3}%|care signal/i.test(blob));
  console.log("✓ load context without scores / jargon");
}

// Unknowns stay unknown
{
  const u = processCareSignalUnderstanding({
    raw_input: "The doctor changed her medication.",
  });
  assert.ok(
    u.uncertain.length >= 1 ||
      u.extraction_summary.decisions >= 1 ||
      u.what_would_improve_understanding.length >= 1,
  );
  console.log("✓ missing context preserved");
}

// Live path wiring
{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetMultiCaregiverContextStore();
  const r = await processSituationInput({
    raw_input:
      "Blood pressure checks every morning now and the refill is stuck. I can't tell what needs attention first.",
    caregiver_id: "care_csl_wire",
  });
  assert.ok(r.care_signal_understanding_layer);
  assert.equal(
    r.care_signal_understanding_layer!.raw_input_preserved,
    "Blood pressure checks every morning now and the refill is stuck. I can't tell what needs attention first.",
  );
  assert.equal(r.care_signal_understanding_layer!.rejects_task_pipeline, true);
  const fo = JSON.stringify(r.final_output ?? {}).toLowerCase();
  assert.ok(!containsCareSignalUiLeakage(fo));
  console.log("✓ wired on situation-entry path");
}

// No scenario detectors in module source
{
  const src = fs.readFileSync(
    path.join(root, "src/lib/care-signal-understanding/index.ts"),
    "utf8",
  );
  assert.ok(!/if\s*\(.*\bfood\b.*\)\s*\{/.test(src));
  assert.ok(!/mom_confusion|eating_detector|fall_detector/.test(src));
  console.log("✓ module has no illustration product branches");
}

console.log("\nverify:care-signal-understanding OK");
