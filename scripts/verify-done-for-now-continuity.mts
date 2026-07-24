/**
 * Done for now = pause only — ACS observations + durable reality survive the button.
 */
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  pauseActiveCareSituationSession,
  getActiveCareSituation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import {
  buildReturnContinuityProjection,
  markInteractionPaused,
  resetReturnContinuityStore,
} from "../src/lib/return-continuity";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux/event-clarifiers";

const careKey = `verify_done_pause_${Date.now().toString(36)}`;

resetActiveCareSituationStore();
resetCareRealityStateStore();
resetReturnContinuityStore();

ingestActiveCareObservation({
  caregiverId: careKey,
  rawText: "Mom fell in the hallway this evening.",
  kind: classifyCareEventKind("Mom fell in the hallway this evening."),
  nowIso: "2026-07-17T22:00:00.000Z",
});
ingestActiveCareObservation({
  caregiverId: careKey,
  rawText: "She did not hit her head. She is sitting with me now.",
  kind: classifyCareEventKind("She did not hit her head. She is sitting with me now."),
  nowIso: "2026-07-17T22:05:00.000Z",
});

const before = getActiveCareSituation(careKey);
assert.ok(before, "ACS present before pause");
assert.ok(before.observations.length >= 1, "ACS has at least one observation before pause");
const obsBefore = before.observations.length;
const lifecycleBefore = before.lifecycle_status;

const paused = pauseActiveCareSituationSession(careKey);
markInteractionPaused(careKey, "2026-07-17T22:10:00.000Z");
assert.ok(paused?.interaction_paused_at, "interaction paused");
assert.notEqual(paused?.lifecycle_status, "resolved", "Done for now must not resolve");
assert.equal(
  paused?.lifecycle_status,
  lifecycleBefore,
  "Done for now must not flip Active→Quiet — engine owns lifecycle",
);
assert.equal(
  paused?.observations.length,
  obsBefore,
  "observations survive pause unchanged",
);

const after = getActiveCareSituation(careKey);
assert.ok(after?.interaction_paused_at, "paused flag persisted on ACS");
assert.equal(after?.observations.length, obsBefore);

const rc = buildReturnContinuityProjection({
  careKey,
  acs: after,
  crs: null,
  nowIso: "2026-07-17T22:10:01.000Z",
  offerSoftInvite: false,
});
assert.equal(rc.has_durable_care_reality, true);
assert.equal(rc.suppress_first_time_ux, true);

// Source gate: shell must not wipe Open situations on Done for now.
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const home = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
  assert(
    !/onPauseActive\(\)\s*=>\s*\{[\s\S]*?situations:\s*\[\s*\]/.test(home),
    "page.tsx must not clear situations: [] on Done for now",
  );
  assert(
    !/freshEnter[\s\S]{0,200}persistSituations\(\[\s*\]\)/.test(home) ||
      home.includes("Do not wipe local situations until"),
    "page.tsx must not wipe local situations on Begin before durable restore",
  );
  const workspace = fs.readFileSync(
    path.join(process.cwd(), "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
    "utf8",
  );
  assert(
    !/setSessionHasNote\(false\);\s*setHasContextRoot\(false\)/.test(workspace),
    "Done for now must not reset continuity flags to first-time UX",
  );
}

console.log("verify:done-for-now-continuity PASS");
