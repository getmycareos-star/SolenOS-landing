/**
 * Situation Generator — Active Situation understanding (not fact-list summary).
 * SoT: docs/02-product/solenos-situation-generator.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SITUATION_GENERATOR_PURPOSE,
  generateActiveSituation,
  orientationFromGeneratedSituation,
  containsSituationSummaryTheater,
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

console.log("=== Situation Generator ===\n");
console.log(SITUATION_GENERATOR_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-situation-generator.md"),
  "utf8",
);
assert.ok(/What is happening right now/i.test(sot));
assert.ok(/Situation generation/i.test(sot));
assert.ok(/must not conclude|Not diagnosis/i.test(sot));
console.log("✓ SoT present");

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "sg_dad_med";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Dad" });

  const dump =
    "Dad has started forgetting where things are, he stopped enjoying his morning routine, and after his medication changed he seems more tired.";

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T21:00:00.000Z",
  });

  const generated = generateActiveSituation({
    situation: turn.situation,
    latestRawText: dump,
    careKey,
    person: "Dad",
  });

  assert.equal(generated.care_recipient, "Dad");
  assert.ok(generated.is_rich_situation, "multi-facet situation");
  assert.ok(generated.observed_changes.length >= 2, "observed changes held");
  assert.ok(
    generated.possible_relationships.some((p) => /medication/i.test(p.summary)),
    "medication possible link",
  );
  assert.ok(generated.unknowns.length >= 1);
  assert.equal(generated.confidence.cause, "low");

  const orient = orientationFromGeneratedSituation(generated);
  assert.ok(orient.current_understanding);
  assert.ok(
    /routine|energy|daily behavior|changed recently|several changes|medication change|confusion|memory change/i.test(
      orient.current_understanding!,
    ),
    `understanding not fact list — got: ${orient.current_understanding!.slice(0, 300)}`,
  );
  assert.ok(generated.clinical_classification.primary.length >= 2, "clinical categories held");
  assert.ok(orient.what_changed);
  assert.ok(orient.connected_note && /medication/i.test(orient.connected_note));
  assert.ok(
    orient.one_thing_to_add &&
      /medication changed|reason for the change/i.test(orient.one_thing_to_add),
  );
  assert.ok(!containsSituationSummaryTheater(orient.current_understanding!));
  assert.ok(!/you mentioned|here are your tasks|dementia is progressing/i.test(
    `${orient.current_understanding} ${orient.what_changed}`,
  ));

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

  assert.ok(
    /routine|energy|behavior|tired|morning|forget|several changes|confusion|memory|medication change/i.test(
      blob,
    ),
    `must orient to care situation — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    /medication/i.test(blob),
    `must hold medication connection — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(!containsSituationSummaryTheater(blob));
  assert.ok(!/here are your tasks|you should contact|care summary/i.test(blob));
  assert.ok(!/dementia is progressing|medication caused|is declining/i.test(blob));
  console.log("✓ acceptance: Dad multi-change → situation understanding");
}

{
  // Linking across separate captures — hospital then sleep then medication
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "sg_link_chain";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: "Mom went to the hospital last week.",
    kind: "general",
    nowIso: "2026-07-10T10:00:00.000Z",
  });
  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: "She has been sleeping more.",
    kind: "general",
    nowIso: "2026-07-15T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: "The doctor changed one medication.",
    kind: "general",
    nowIso: "2026-07-18T10:00:00.000Z",
  });

  const generated = generateActiveSituation({
    situation: turn.situation,
    latestRawText: "The doctor changed one medication.",
    careKey,
    person: "Mom",
  });
  assert.ok(
    generated.related_events.some((e) => /hospital|medication|medicine|doctor/i.test(e)) ||
      generated.possible_relationships.length >= 1,
    "cross-turn medical context held as related — not three unrelated notes only",
  );
  console.log("✓ cross-turn: hospital / sleep / medication linked as possible situation");
}

console.log("\nverify:situation-generator OK");
