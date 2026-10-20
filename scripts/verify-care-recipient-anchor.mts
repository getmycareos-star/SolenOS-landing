/**
 * Care Recipient Anchor — Architecture Correction #1.
 * SoT: docs/02-product/solenos-care-recipient-anchor.md
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARE_RECIPIENT_ANCHOR_PURPOSE,
  CARE_REALITY_PROCESSING_ORDER,
  buildCareRecipientAnchor,
  centersContributorConflictOverRecipient,
  composeCareRecipientIdentityAsk,
} from "../src/lib/care-reality-intelligence";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import {
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";

console.log("=== Care Recipient Anchor ===\n");
console.log(CARE_RECIPIENT_ANCHOR_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-care-recipient-anchor.md"),
  "utf8",
);
assert.ok(/Who is this care story about/i.test(sot));
assert.ok(/Care Recipient[\s\S]*Current State Changes/i.test(sot));
assert.equal(CARE_REALITY_PROCESSING_ORDER[0], "care_recipient");
assert.equal(CARE_REALITY_PROCESSING_ORDER[CARE_REALITY_PROCESSING_ORDER.length - 1], "caregiver_context");
assert.equal(composeCareRecipientIdentityAsk(), "Who is this situation about?");
console.log("✓ SoT + processing order");

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const contributorId = "cra_mom_hospital";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const dump = `
Mom has dementia and recently came home from hospital.
She has been confused, sleeping more, eating less, and yesterday tried leaving the house.
My brother says I'm worrying too much.
  `.trim();

  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T19:00:00.000Z",
  });

  const anchor = buildCareRecipientAnchor({
    situation: turn.situation,
    latestRawText: dump,
    careKey,
  });
  assert.equal(anchor.care_recipient, "Mom");
  assert.equal(anchor.needs_identity_ask, false);
  assert.ok(anchor.recipient_changes.length >= 1, "recipient-centered changes");
  assert.ok(
    anchor.contributor_context.length >= 1 ||
      anchor.extraction?.non_care_facts.some((n) => n.layer === "disagreement_perspective"),
    "brother disagreement held as contributor context",
  );
  assert.ok(
    !anchor.recipient_changes.some((c) => /brother|worrying too much/i.test(c)),
    "disagreement must not be a recipient change",
  );

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
    composed.confirmation,
  ].join(" ");

  assert.ok(/mom/i.test(blob), `must orient around Mom — got: ${blob.slice(0, 350)}`);
  assert.ok(
    !centersContributorConflictOverRecipient({
      blob,
      careRecipient: "Mom",
      hasRecipientChanges: true,
    }),
    "must not center brother disagreement over Mom",
  );
  assert.ok(!/here are your tasks|you should contact|care summary/i.test(blob));
  assert.ok(
    !/your brother may not understand/i.test(blob),
    "must not take sides",
  );
  console.log("✓ acceptance: Mom-centered orientation; brother = context");
}

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const turn = ingestActiveCareObservation({
    caregiverId: "cra_unknown_who",
    rawText: "Something feels different lately and I am not sure what matters.",
    kind: "general",
    nowIso: "2026-07-20T19:05:00.000Z",
  });
  const anchor = buildCareRecipientAnchor({
    situation: { ...turn.situation, subject_label: "they" },
    latestRawText: "Something feels different lately.",
    careKey: "cra_unknown_who",
  });
  assert.equal(anchor.needs_identity_ask, true);
  assert.equal(anchor.identity_ask, "Who is this situation about?");
  console.log("✓ unknown recipient → soft ask, no guess");
}

{
  // Kinship in the note is session orientation — never blank "Who is this?" (Locked A: no durable write).
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const note =
    "mom is not feeling well and i took her to the doctor, she havent been eating well and sleeping well lately";
  const turn = ingestActiveCareObservation({
    caregiverId: "cra_kinship_session",
    rawText: note,
    kind: "general",
    nowIso: "2026-07-22T16:00:00.000Z",
  });
  const anchor = buildCareRecipientAnchor({
    situation: { ...turn.situation, subject_label: "they" },
    latestRawText: note,
    careKey: "cra_kinship_session",
  });
  assert.equal(anchor.care_recipient, "Mom");
  assert.equal(anchor.needs_identity_ask, false);
  assert.ok(anchor.extraction);
  assert.ok(
    (anchor.extraction?.observations.length ?? 0) +
      (anchor.extraction?.events.length ?? 0) +
      (anchor.extraction?.actions.length ?? 0) >=
      2,
    "must partition feeling / visit / daily changes — not one blob",
  );

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: note,
    kind: "general",
  });
  const blob = [
    composed.recognition_line ?? "",
    composed.confirmation,
    composed.situation_summary ?? "",
    composed.what_matters_now ?? "",
    composed.care_story_update ?? "",
    ...(composed.still_unclear ?? []),
    ...(composed.what_we_know ?? []),
  ].join("\n");
  assert.ok(!/Who is this situation about/i.test(blob), "must not ask who when Mom is in the note");
  assert.ok(
    !/What stands out: mom is not feeling well and i took her/i.test(blob),
    "must not paste full note into recognition",
  );
  assert.ok(
    !/noticing whether this continues \(mom is not feeling/i.test(blob),
    "must not paste full note into what matters",
  );
  assert.ok(/mom/i.test(blob), "must orient around Mom from session kinship");
  console.log("✓ kinship in note → session Mom; no blank who-ask; no raw-note paste");
}

console.log("\nverify:care-recipient-anchor OK");
