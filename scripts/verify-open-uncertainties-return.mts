/**
 * verify-open-uncertainties-return.mts
 * Phase 5.2 — uncertainty lifecycle + G10 soft return invite (decision B).
 * SoT: docs/02-product/solenos-open-uncertainties-return.md
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ingestActiveCareObservation,
  pauseActiveCareSituationSession,
  getActiveCareSituation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import {
  getCareRealityState,
  resetCareRealityStateStore,
} from "../src/lib/care-reality-state";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { questionFamily } from "../src/lib/progressive-understanding";
import {
  buildReturnContinuityProjection,
  markInteractionPaused,
  resetReturnContinuityStore,
} from "../src/lib/return-continuity";

const root = process.cwd();

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetReturnContinuityStore();
}

console.log("=== Open Uncertainties Return (Phase 5.2) ===\n");

assert.ok(
  fs.existsSync(path.join(root, "docs/02-product/solenos-open-uncertainties-return.md")),
  "open uncertainties product SoT",
);
console.log("✓ product SoT present");

// Done when — answering "when it started" removes timing ask from CRS + compose
{
  resetAll();
  const careKey = "cg_timing_answer";
  const fall = "Mom fell in the hallway this morning.";
  const t1 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: fall,
    kind: classifyCareEventKind(fall),
    nowIso: "2026-09-01T10:00:00.000Z",
  });
  void t1;
  const timingAsk = "When did this start — or has it been going on?";
  getActiveCareSituation(careKey)!.open_questions.push(timingAsk);
  getCareRealityState(careKey)!.open_uncertainties.push(timingAsk);

  const t2 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "It started yesterday morning when she got up.",
    kind: classifyCareEventKind("It started yesterday morning when she got up."),
    nowIso: "2026-09-01T10:05:00.000Z",
  });
  assert.ok(
    t2.relation === "answers_uncertainty" || t2.resolved_uncertainties.length >= 1,
    "timing answer closes uncertainty (relation or resolved list)",
  );

  const crs = getCareRealityState(careKey)!;
  assert.ok(
    !crs.open_uncertainties.some((q) => questionFamily(q) === "timing"),
    "CRS timing family closed after answer",
  );
  assert.ok(
    crs.resolved_uncertainties.some((q) => questionFamily(q) === "timing") ||
      t2.resolved_uncertainties.some((q) => questionFamily(q) === "timing"),
    "timing gap recorded resolved",
  );

  const c2 = composeCaregiverResponse({
    turn: t2,
    latestRawText: "It started yesterday morning when she got up.",
    kind: classifyCareEventKind("It started yesterday morning when she got up."),
  });
  assert.ok(
    !c2.still_unclear.some((q) => /when did this start|going on/i.test(q)),
    "compose does not re-ask timing on answer turn",
  );

  const t3 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She also seemed confused today.",
    kind: classifyCareEventKind("She also seemed confused today."),
    nowIso: "2026-09-01T10:10:00.000Z",
  });
  const c3 = composeCaregiverResponse({
    turn: t3,
    latestRawText: "She also seemed confused today.",
    kind: classifyCareEventKind("She also seemed confused today."),
  });
  assert.ok(
    !c3.still_unclear.some((q) => /when did this start|going on/i.test(q)),
    "same session never re-asks timing family",
  );
  console.log("✓ answering when-it-started closes timing gap (CRS + compose)");
}

// Unanswered gap persists; soft invite once on return (G10 / decision B)
{
  resetAll();
  const careKey = "cg_soft_invite_open";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this morning.",
    kind: classifyCareEventKind("Mom fell in the hallway this morning."),
    nowIso: "2026-10-01T10:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey)!;
  const gap = "Did she hit her head?";
  acs.open_questions.push(gap);
  const crs = getCareRealityState(careKey)!;
  crs.open_uncertainties.push(gap);

  pauseActiveCareSituationSession(careKey);
  markInteractionPaused(careKey, "2026-10-01T10:30:00.000Z");

  const first = buildReturnContinuityProjection({
    careKey,
    acs: getActiveCareSituation(careKey),
    crs: getCareRealityState(careKey),
    nowIso: "2026-10-01T12:00:00.000Z",
    offerSoftInvite: true,
  });
  assert.equal(first.soft_invite.offered_now, true, "soft invite offered once");
  assert.ok(/still open/i.test(first.soft_invite.text ?? ""), "invite references open gap");

  const second = buildReturnContinuityProjection({
    careKey,
    acs: getActiveCareSituation(careKey),
    crs: getCareRealityState(careKey),
    nowIso: "2026-10-01T13:00:00.000Z",
    offerSoftInvite: true,
  });
  assert.equal(second.soft_invite.offered_now, false, "never re-offers invite same return arc");
  console.log("✓ unanswered gap → one soft return invite only");
}

// Auto-close head-injury gap when answered (CRS sync)
{
  resetAll();
  const careKey = "cg_head_close";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this morning.",
    kind: classifyCareEventKind("Mom fell in the hallway this morning."),
    nowIso: "2026-11-01T10:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey)!;
  acs.open_questions = ["Did she hit her head?"];
  getCareRealityState(careKey)!.open_uncertainties = ["Did she hit her head?"];

  const t2 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "No, she did not hit her head.",
    kind: classifyCareEventKind("No, she did not hit her head."),
    nowIso: "2026-11-01T10:30:00.000Z",
  });
  assert.equal(t2.relation, "answers_uncertainty");
  const afterCrs = getCareRealityState(careKey)!;
  assert.ok(
    !afterCrs.open_uncertainties.some((q) => /hit her head/i.test(q)),
    "CRS removes answered head gap",
  );
  console.log("✓ answers_uncertainty closes CRS open gap");
}

console.log("\nverify:open-uncertainties-return OK");
