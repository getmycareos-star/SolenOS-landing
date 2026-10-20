/**
 * Intelligence Layer — do not hardcode examples as keywords.
 * SoT: docs/02-product/solenos-intelligence-no-hardcode.md
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARE_REALITY_ATTENTION_RANK,
  CARE_REALITY_REASONING_STRUCTURE,
  INTELLIGENCE_LAYER_ASK,
  INTELLIGENCE_LAYER_NEVER_ASK,
  INTELLIGENCE_NO_HARDCODE_PURPOSE,
  attentionRankForExtractionCategory,
  containsKeywordClassifierTheater,
} from "../src/lib/care-reality-intelligence";
import {
  classifyExtractionFragment,
  extractCareRealityFromText,
} from "../src/lib/care-reality-extraction";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { heldFocusLines } from "../src/lib/progressive-understanding/clarity-pillars";

console.log("=== Intelligence no-hardcode ===\n");
console.log(INTELLIGENCE_NO_HARDCODE_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-intelligence-no-hardcode.md"),
  "utf8",
);
assert.ok(/Do not build SolenOS around fixed words/i.test(sot));
assert.ok(/Detected keywords/i.test(sot));
assert.ok(/Care Reality Engine/i.test(sot));
console.log("✓ SoT present");

assert.ok(CARE_REALITY_REASONING_STRUCTURE.includes("current_understanding"));
assert.ok(CARE_REALITY_ATTENTION_RANK[0] === "condition_change");
assert.ok(CARE_REALITY_ATTENTION_RANK[CARE_REALITY_ATTENTION_RANK.length - 1].includes("family"));
assert.ok(/what is happening/i.test(INTELLIGENCE_LAYER_ASK));
assert.ok(/words appeared/i.test(INTELLIGENCE_LAYER_NEVER_ASK));
console.log("✓ reasoning structure + attention rank (engine-only)");

assert.ok(containsKeywordClassifierTheater("Detected keywords: confusion, medication, fall."));
assert.ok(containsKeywordClassifierTheater("Keywords matched: sleep"));
assert.ok(!containsKeywordClassifierTheater("Looking at the changes over time in the care story."));
console.log("✓ keyword-classifier theater detection");

assert.ok(attentionRankForExtractionCategory("observation") < attentionRankForExtractionCategory("decision"));
assert.ok(
  attentionRankForExtractionCategory("decision") <
    attentionRankForExtractionCategory("disagreement_perspective"),
);
console.log("✓ attention ranking prefers condition evidence over family dynamics");

// Illustration fixture only — never product if-branches on these nouns
{
  const messy =
    "Mom keeps asking where Dad is even though he passed years ago. She got upset when I told her. My brother thinks I'm worrying too much.";
  const extracted = extractCareRealityFromText({ rawText: messy, source: "caregiver" });
  assert.ok(extracted.observations.length >= 1, "messy cognitive/behavior reality → observations");
  assert.ok(
    extracted.non_care_facts.some((n) => n.layer === "disagreement_perspective"),
    "family dynamics preserved as context — not primary observation",
  );
  assert.equal(classifyExtractionFragment("She has been sleeping a lot more."), "observation");
}

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();

  const dump = `
Mom keeps asking where Dad is even though he passed years ago. She got upset when I told her.
My brother thinks I'm worrying too much, but he's not here every day.
I'm trying to keep track of everything that's changing.
  `.trim();

  const turn = ingestActiveCareObservation({
    caregiverId: "intel_no_hardcode",
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T17:00:00.000Z",
  });
  const focus = heldFocusLines(turn.situation, 2).join(" ");
  assert.ok(
    !/brother thinks|worrying too much|keep track of everything/i.test(focus),
    `focus must not center family/load — got: ${focus}`,
  );
  assert.ok(
    /ask|upset|dad|passed|years/i.test(focus),
    `focus should center care-reality change — got: ${focus}`,
  );

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: dump,
    kind: "general",
  });
  const blob = [
    composed.confirmation,
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
  ].join(" ");
  assert.ok(!containsKeywordClassifierTheater(blob));
  assert.ok(!/detected keywords|symptom classifier/i.test(blob));
  console.log("✓ messy input → care reality understanding, not keyword dump");
}

console.log("\nverify:intelligence-no-hardcode OK");
