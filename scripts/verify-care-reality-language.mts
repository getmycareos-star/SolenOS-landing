/**
 * Care Reality Language — never notes/documentation theater.
 * SoT: docs/02-product/solenos-care-reality-language.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { containsInternalLanguage } from "../src/lib/output-quality";
import {
  RESPONSE_NOTES_DOCUMENTATION_PATTERNS,
  assertResponseAcceptanceGate,
} from "../src/lib/response-acceptance-gate";
import { ATTENTION_LABELS_BY_RISK } from "../src/lib/response-intelligence/attention-label";
import { matchesForbiddenCopyPattern } from "../src/lib/caregiver-reality-principles/forbidden-copy-patterns";
import { caregiverNoteMetaLabel } from "../src/lib/care-memory-maturity";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { readFileSync } from "node:fs";
import { join } from "node:path";

console.log("=== Care Reality Language (not Care Notes) ===\n");

const failDocs = [
  "I have added this to your care notes.",
  "Your notes show Dad stopped eating.",
  "Based on your previous entries, medication changed.",
  "I saved a note about Dad's eating and medication.",
  "Related notes are connecting in the living care record.",
  "A related note was added to today's situation.",
  "Held with today's notes.",
];

for (const line of failDocs) {
  assert.ok(
    RESPONSE_NOTES_DOCUMENTATION_PATTERNS.some((p) => p.test(line)),
    `must reject documentation language: ${line}`,
  );
  assert.ok(
    containsInternalLanguage(line) ||
      matchesForbiddenCopyPattern(line) ||
      /related notes?/i.test(line) ||
      /today'?s notes/i.test(line),
    `must flag notes/storage framing: ${line}`,
  );
}
console.log("✓ documentation / notes-app patterns rejected");

assert.ok(!/Lower attention/i.test(ATTENTION_LABELS_BY_RISK.low));
assert.ok(/Can wait|Needs attention now/i.test(ATTENTION_LABELS_BY_RISK.high));
assert.ok(
  !/care notes/i.test(
    caregiverNoteMetaLabel({ careWorthyCount: 1, latestIsCareWorthy: false }),
  ),
);
console.log("✓ attention + meta labels use understanding language");

const panel = readFileSync(
  join(process.cwd(), "src/components/mvp-workspace/LivingCareRecordPanel.tsx"),
  "utf8",
);
assert.ok(!/Supporting notes/.test(panel));
assert.ok(/What supports this understanding/.test(panel));
assert.ok(!/Add related note/.test(panel));
assert.ok(/Tell us what happened/.test(panel));
console.log("✓ Living Care Record UI has no notes chrome");

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();

  // Illustration fixture only — avoid “stopped” near medication (false positive on unknown gate).
  const raw =
    "Dad is not eating normally after his fall. The doctor changed his medication last week.";
  const turn = ingestActiveCareObservation({
    caregiverId: "crl_lang_accept",
    rawText: raw,
    kind: "general",
    nowIso: "2026-07-20T16:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: raw,
    kind: "general",
  });
  const blob = [
    composed.confirmation,
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.connection_note ?? "",
    composed.care_story_update ?? "",
    ...(composed.what_we_know ?? []),
  ].join(" ");

  assert.ok(
    !RESPONSE_NOTES_DOCUMENTATION_PATTERNS.some((p) => p.test(blob)),
    `composer must not speak notes/storage — got: ${blob.slice(0, 280)}`,
  );
  assert.ok(
    !/saved a note|care notes|your notes show|previous entries|related note|today'?s notes/i.test(
      blob,
    ),
  );

  assertResponseAcceptanceGate({
    composed,
    careMemoryState: "new_care_reality",
    observationCount: turn.situation.observations.length,
    careWorthyCount: turn.situation.observations.length,
    latestIsCareWorthy: true,
    latestRawText: raw,
    turnClass: "observation",
  });
  console.log("✓ acceptance test: understanding language, not saved-note theater");
}

console.log("\nverify:care-reality-language OK");
