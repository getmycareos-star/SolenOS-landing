/**
 * verify-return-continuity.mts
 * G10 soft invite · G11 Begin restore · G18 long absence — spine behavior.
 * Open uncertainties Locked B: persist · one soft invite · auto-close · no hydrate burn.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ingestActiveCareObservation,
  pauseActiveCareSituationSession,
  getActiveCareSituation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { getCareRealityState, resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import {
  buildReturnContinuityProjection,
  markInteractionPaused,
  markInteractionTouched,
  resetReturnContinuityStore,
  clearSoftInviteWhenUncertaintyGone,
  LONG_ABSENCE_THRESHOLD_MS,
} from "../src/lib/return-continuity";
import { ensureClientDurableCareKey, mintDurableCareKey } from "../src/lib/care-identity";
import { resolveAnsweredUncertainties } from "../src/lib/progressive-understanding";

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetReturnContinuityStore();
}

console.log("=== Return Continuity (G10 / G11 / G18) ===\n");

// Source gate: Begin must not remint care key
{
  const workspace = fs.readFileSync(
    path.join(process.cwd(), "src/app/workspace/page.tsx"),
    "utf8",
  );
  assert(
    !/freshEnter\s*\?\s*mintDurableCareKey/.test(workspace),
    "G11: Begin must not mintDurableCareKey",
  );
  assert(
    workspace.includes("ensureClientDurableCareKey(previousKey)"),
    "G11: Begin reuses durable key",
  );
  assert(
    workspace.includes("ensureClientInteractionSessionId"),
    "G11: Begin may mint interaction session",
  );
  assert(workspace.includes("forceNew: freshEnter"), "G11: Begin forceNew session only");
  assert(!/pauseKey\(careKey\)/.test(workspace), "G11: Begin must not pause ACS on enter");
  assert(
    /offer_return_invite=0/.test(workspace),
    "Locked B: page hydrate must not consume soft invite",
  );
  console.log("✓ G11 source: Begin reuses durable care key");
  console.log("✓ Locked B: workspace hydrate uses offer_return_invite=0");
}

// Workspace: mount does not burn invite; Done path offers once
{
  const ws = fs.readFileSync(
    path.join(process.cwd(), "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
    "utf8",
  );
  assert(
    /offer_return_invite=0/.test(ws),
    "Locked B: mount hydrate must not consume soft invite",
  );
  assert(
    /offer_return_invite=1/.test(ws),
    "Locked B: Done-for-now return path must request soft invite once",
  );
  assert(
    /pause_active_care_situation/.test(ws),
    "Done for now uses pause action",
  );
  console.log("✓ Locked B: Done path requests soft invite once; mount does not burn it");
}

// ensureClientDurableCareKey stability + session ≠ care key
{
  const a = mintDurableCareKey();
  assert.equal(ensureClientDurableCareKey(a), a, "reuse existing key");
  const b = ensureClientDurableCareKey(a);
  assert.equal(b, a, "stable across calls");
  assert.equal(
    ensureClientDurableCareKey("default_caregiver"),
    "default_caregiver",
    "Locked A: do not orphan default_caregiver",
  );
  console.log("✓ durable care key reuse");
}

// G10 — soft invite once after pause
{
  resetAll();
  const careKey = "cg_g10_return";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this morning.",
    kind: classifyCareEventKind("Mom fell in the hallway this morning."),
    nowIso: "2026-04-01T10:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey);
  assert(acs != null, "ACS present");
  // Ensure an open uncertainty exists for invite
  if (acs && acs.open_questions.length === 0) {
    acs.open_questions.push("Did she hit her head?");
  }
  pauseActiveCareSituationSession(careKey);
  markInteractionPaused(careKey, "2026-04-01T10:30:00.000Z");

  const crs = getCareRealityState(careKey);
  const first = buildReturnContinuityProjection({
    careKey,
    acs: getActiveCareSituation(careKey),
    crs,
    nowIso: "2026-04-01T12:00:00.000Z",
    offerSoftInvite: true,
  });
  assert(first.is_return === true, "G10 is return after pause");
  assert(first.soft_invite.offered_now === true, "G10 soft invite offered once");
  assert(first.soft_invite.text != null && /still open/i.test(first.soft_invite.text), "G10 invite text");
  assert(first.suppress_first_time_ux === true, "G10 not first-time UX");

  const second = buildReturnContinuityProjection({
    careKey,
    acs: getActiveCareSituation(careKey),
    crs: getCareRealityState(careKey),
    nowIso: "2026-04-01T13:00:00.000Z",
    offerSoftInvite: true,
  });
  assert(second.soft_invite.offered_now === false, "G10 never re-offers");
  assert(second.soft_invite.text == null, "G10 no repeated pressure text");
  console.log("✓ G10 soft invite once after Done for now");
}

// Locked B — known-unknowns persist across a note that does not answer them
{
  resetAll();
  const careKey = "cg_known_unknown_persist";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this morning.",
    kind: classifyCareEventKind("Mom fell in the hallway this morning."),
    nowIso: "2026-06-01T10:00:00.000Z",
  });
  const firstAcs = getActiveCareSituation(careKey)!;
  if (firstAcs.open_questions.length === 0) {
    firstAcs.open_questions.push("Did she hit her head?");
  }
  const gap = firstAcs.open_questions[0]!;
  const firstCrs = getCareRealityState(careKey)!;
  // Mirror ACS known-unknown into CRS if ingest had not yet (seeded gap).
  if (!firstCrs.open_uncertainties.includes(gap)) {
    firstCrs.open_uncertainties.push(gap);
  }

  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She seemed tired after lunch.",
    kind: classifyCareEventKind("She seemed tired after lunch."),
    nowIso: "2026-06-01T11:00:00.000Z",
  });
  const after = getActiveCareSituation(careKey)!;
  const afterCrs = getCareRealityState(careKey)!;
  assert(
    after.open_questions.some((q) => q.toLowerCase() === gap.toLowerCase()),
    "Locked B: unanswered gap stays on ACS after unrelated note",
  );
  assert(
    afterCrs.open_uncertainties.some((q) => q.toLowerCase() === gap.toLowerCase()),
    "Locked B: unanswered gap stays on CRS after unrelated note",
  );
  console.log("✓ Locked B: known-unknowns persist across unrelated notes");
}

// Locked B — auto-close when new evidence answers the gap
{
  resetAll();
  const careKey = "cg_auto_close_gap";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this morning.",
    kind: classifyCareEventKind("Mom fell in the hallway this morning."),
    nowIso: "2026-06-02T10:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey)!;
  acs.open_questions = ["Did she hit her head?"];
  const crs = getCareRealityState(careKey)!;
  crs.open_uncertainties = ["Did she hit her head?"];

  const resolved = resolveAnsweredUncertainties({
    openQuestions: ["Did she hit her head?"],
    rawText: "No, she did not hit her head.",
  });
  assert.equal(resolved.remaining.length, 0, "yes/no + content closes head ask");
  assert.equal(resolved.resolved.length, 1, "gap marked resolved");

  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "No, she did not hit her head.",
    kind: classifyCareEventKind("No, she did not hit her head."),
    nowIso: "2026-06-02T10:30:00.000Z",
  });
  const after = getActiveCareSituation(careKey)!;
  const afterCrs = getCareRealityState(careKey)!;
  assert(
    !after.open_questions.some((q) => /hit her head/i.test(q)),
    "Locked B: answered gap removed from ACS",
  );
  assert(
    !afterCrs.open_uncertainties.some((q) => /hit her head/i.test(q)),
    "Locked B: answered gap removed from CRS",
  );
  console.log("✓ Locked B: auto-close when evidence answers the gap");
}

// Locked B — clear one-shot flag only after invited gap is gone (new gap can invite later)
{
  resetAll();
  const careKey = "cg_invite_reset";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell this morning.",
    kind: classifyCareEventKind("Mom fell this morning."),
    nowIso: "2026-06-03T09:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey)!;
  acs.open_questions = ["Did she hit her head?"];
  pauseActiveCareSituationSession(careKey);
  markInteractionPaused(careKey, "2026-06-03T09:15:00.000Z");
  const offered = buildReturnContinuityProjection({
    careKey,
    acs: getActiveCareSituation(careKey),
    crs: getCareRealityState(careKey),
    nowIso: "2026-06-03T10:00:00.000Z",
    offerSoftInvite: true,
  });
  assert(offered.soft_invite.offered_now === true, "invite consumed once");

  clearSoftInviteWhenUncertaintyGone({
    careKey,
    openUncertainties: ["Did she hit her head?"],
  });
  const stillBlocked = buildReturnContinuityProjection({
    careKey,
    acs: getActiveCareSituation(careKey),
    crs: getCareRealityState(careKey),
    nowIso: "2026-06-03T11:00:00.000Z",
    offerSoftInvite: true,
  });
  assert(stillBlocked.soft_invite.offered_now === false, "still open → no re-invite");

  clearSoftInviteWhenUncertaintyGone({
    careKey,
    openUncertainties: [],
  });
  acs.open_questions = ["Is appetite different from usual?"];
  pauseActiveCareSituationSession(careKey);
  markInteractionPaused(careKey, "2026-06-03T12:00:00.000Z");
  const nextGap = buildReturnContinuityProjection({
    careKey,
    acs: getActiveCareSituation(careKey),
    crs: getCareRealityState(careKey),
    nowIso: "2026-06-03T13:00:00.000Z",
    offerSoftInvite: true,
  });
  assert(nextGap.soft_invite.offered_now === true, "new gap after prior closed → one invite");
  console.log("✓ Locked B: invite flag clears only when invited gap is gone");
}

// G11 — pause + return restores ACS/CRS (same key)
{
  resetAll();
  const careKey = "cg_g11_begin";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Dad refused lunch today.",
    kind: classifyCareEventKind("Dad refused lunch today."),
    nowIso: "2026-05-01T11:00:00.000Z",
  });
  const before = getActiveCareSituation(careKey);
  const crsBefore = getCareRealityState(careKey);
  assert(before != null && crsBefore != null, "G11 reality before pause");
  pauseActiveCareSituationSession(careKey);
  markInteractionPaused(careKey, "2026-05-01T11:15:00.000Z");

  const afterAcs = getActiveCareSituation(careKey);
  const afterCrs = getCareRealityState(careKey);
  assert(afterAcs?.id === before!.id, "G11 ACS persists across pause");
  assert(afterCrs?.id === crsBefore!.id, "G11 CRS persists across pause");
  assert(afterAcs?.observations.length === before!.observations.length, "G11 observations intact");

  markInteractionTouched(careKey, "2026-05-01T18:00:00.000Z");
  const resume = buildReturnContinuityProjection({
    careKey,
    acs: afterAcs,
    crs: afterCrs,
    nowIso: "2026-05-01T18:00:00.000Z",
    offerSoftInvite: false,
  });
  assert(resume.has_durable_care_reality === true, "G11 durable reality restored");
  console.log("✓ G11 durable ACS/CRS persist across pause/Begin");
}

// G18 — long absence projection
{
  resetAll();
  const careKey = "cg_g18_long";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom seemed quieter after the visit.",
    kind: classifyCareEventKind("Mom seemed quieter after the visit."),
    nowIso: "2026-01-01T10:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey)!;
  if (acs.open_questions.length === 0) {
    acs.open_questions.push("Is this different from her usual?");
  }
  markInteractionPaused(careKey, "2026-01-01T10:30:00.000Z");

  const longNow = new Date(
    Date.parse("2026-01-01T10:30:00.000Z") + LONG_ABSENCE_THRESHOLD_MS + 1000,
  ).toISOString();
  const g18 = buildReturnContinuityProjection({
    careKey,
    acs: getActiveCareSituation(careKey),
    crs: getCareRealityState(careKey),
    nowIso: longNow,
    offerSoftInvite: true,
  });
  assert(g18.is_long_absence === true, "G18 long absence");
  assert(g18.is_return === true, "G18 is return");
  assert(g18.recent_relevant_changes.length > 0, "G18 recent relevant changes");
  assert(g18.important_unresolved.length > 0, "G18 important unresolved");
  assert(g18.suppress_first_time_ux === true, "G18 not first-time UX");
  assert(g18.recent_relevant_changes.length <= 3, "G18 no history dump");
  console.log("✓ G18 long-absence return projection");
}

console.log("\n=== Return Continuity: all checks passed ===\n");
