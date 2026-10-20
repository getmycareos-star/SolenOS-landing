/**
 * verify-active-care-situation.mts
 * Related observations must build one evolving situation — not restart a template.
 * Relation is server-owned: soft same-day defaults to update (no client entryIntent).
 */

import {
  clearActiveCareSituation,
  classifySituationRelation,
  getActiveCareSituation,
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import fs from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Active Care Situation ===\n");

resetActiveCareSituationStore();

const t1 = ingestActiveCareObservation({
  caregiverId: "cg_acs",
  rawText: "She's frustrated.",
  kind: classifyCareEventKind("She's frustrated."),
  nowIso: "2026-07-16T14:00:00.000Z",
});

assert(t1.relation === "opens_new", "input1 opens new");
assert(t1.situation.understanding_stage === "gathering", "input1 gathering");
assert(/frustrated/i.test(t1.current_understanding.join(" ")), "input1 understands frustrated");
assert(t1.insufficiency_note === null || t1.insufficiency_note.length > 0, "input1 insufficiency optional");
assert(t1.show_attention_sections === false, "too early for what matters dump");
assert(t1.what_needs_context.length <= 1, "input1 at most one ask");
assert(t1.what_matters_now == null, "no Clarity pillar until understanding sufficient");
assert(t1.what_can_wait == null, "no what-can-wait until understanding sufficient");
assert(/Added to the Living Care Record|Held in the Living Care Record/i.test(t1.confirmation_title), "input1 held confirmation");
console.log("✓ input1: She's frustrated. → gather context");

const t2 = ingestActiveCareObservation({
  caregiverId: "cg_acs",
  rawText: "She's sad.",
  kind: classifyCareEventKind("She's sad."),
  nowIso: "2026-07-16T14:05:00.000Z",
});

assert(t2.relation === "updates_active" || t2.relation === "adds_context", "input2 updates");
assert(t2.situation.observations.length === 2, "two observations");
assert(/frustrated/i.test(t2.current_understanding.join(" ")), "still knows frustrated");
assert(/sad/i.test(t2.current_understanding.join(" ")), "knows sad");
assert(t2.what_changed_in_understanding != null, "understanding delta on update");
assert(/Care situation updated|Today's care situation updated|Updated today's care situation/i.test(t2.confirmation_title), "updated confirmation");
assert(/connected|same|together|parts of the same/i.test(t2.connection_note ?? "together"), "connection note");
assert(!/Care Event Added/i.test(t2.confirmation_title), "not a fresh event template");
assert(t2.show_attention_sections === false || t2.understanding_stage !== "gathering", "still early or forming");
console.log("✓ input2: She's sad. → updates same situation (progressive understanding)");

const t3 = ingestActiveCareObservation({
  caregiverId: "cg_acs",
  rawText: "She keeps saying she wants to go home.",
  kind: classifyCareEventKind("She keeps saying she wants to go home."),
  nowIso: "2026-07-16T14:10:00.000Z",
});

assert(t3.situation.observations.length === 3, "three observations");
assert(/go home/i.test(t3.current_understanding.join(" ")), "knows go home");
assert(t3.situation.understanding_stage === "synthesizing", "synthesizing after 3");
// Clarity still gated by understandingSufficient — obs count alone never unlocks.
assert(t3.show_attention_sections === false, "no Clarity until gaps answered");
assert(t3.what_matters_now == null, "no what-matters until sufficient");
assert(t3.what_can_wait == null, "no what-can-wait until sufficient");
assert(t3.what_changed_in_understanding != null, "delta after related note");
assert(
  !t3.what_needs_context.some((q) => /head|fluid|walking normally/i.test(q)),
  "no keyword quiz asks",
);
assert(t3.what_needs_context.length <= 3, "≤3 gap asks while gather incomplete");
console.log("✓ input3: wants to go home → continuous gather, no premature Clarity");

// Soft same-day outside 12h window must still update (server-owned; not restart)
const tSoftLate = ingestActiveCareObservation({
  caregiverId: "cg_acs",
  rawText: "She's quieter this afternoon.",
  kind: classifyCareEventKind("She's quieter this afternoon."),
  nowIso: "2026-07-16T23:30:00.000Z",
});
assert(
  tSoftLate.relation === "updates_active" || tSoftLate.relation === "adds_context",
  "soft same-day outside 12h window still updates",
);
assert(tSoftLate.situation.observations.length === 4, "late soft appends to same ACS");
assert(tSoftLate.situation.id === t1.situation.id, "same situation_id after late soft");
console.log("✓ soft same-day outside window → update (not restart)");

// Hard new event should open separately
const t4 = ingestActiveCareObservation({
  caregiverId: "cg_acs",
  rawText: "Mom fell yesterday. We went to urgent care.",
  kind: classifyCareEventKind("Mom fell yesterday. We went to urgent care."),
  nowIso: "2026-07-16T23:45:00.000Z",
});
assert(t4.relation === "opens_new", "fall opens new situation");
assert(t4.situation.observations.length === 1, "fall is its own situation");
assert(t4.situation.id !== t1.situation.id, "fall gets new ACS id");
console.log("✓ hard event (fall) opens a new situation");

// Soft mood after hard same day opens a new ACS — do not absorb into fall (Clarity bleed).
const tSoftAfterHard = ingestActiveCareObservation({
  caregiverId: "cg_acs",
  rawText: "She's calmer now.",
  kind: classifyCareEventKind("She's calmer now."),
  nowIso: "2026-07-16T23:50:00.000Z",
});
assert(tSoftAfterHard.relation === "opens_new", "soft mood after fall opens new situation");
assert(tSoftAfterHard.situation.id !== t4.situation.id, "soft mood gets its own ACS id");
console.log("✓ soft after hard same day → opens new (no fall absorb)");

// Soft mood after medication ACS must also open new (no med Clarity bleed)
resetActiveCareSituationStore();
const tMed = ingestActiveCareObservation({
  caregiverId: "cg_acs_med",
  rawText: "Doctor changed her blood pressure pill today.",
  kind: classifyCareEventKind("Doctor changed her blood pressure pill today."),
  nowIso: "2026-07-16T14:00:00.000Z",
});
assert(tMed.relation === "opens_new", "med opens new");
const tSoftAfterMed = ingestActiveCareObservation({
  caregiverId: "cg_acs_med",
  rawText: "shes frustrated",
  kind: classifyCareEventKind("shes frustrated"),
  nowIso: "2026-07-16T14:05:00.000Z",
});
assert(tSoftAfterMed.relation === "opens_new", "soft mood after med opens new");
assert(tSoftAfterMed.situation.id !== tMed.situation.id, "soft mood not absorbed into med ACS");
console.log("✓ soft after medication → opens new (no hard absorb)");

// Soft that references the hard event may add context
const tCtxOnFall = ingestActiveCareObservation({
  caregiverId: "cg_acs",
  rawText: "Mom fell yesterday. We went to urgent care.",
  kind: classifyCareEventKind("Mom fell yesterday. We went to urgent care."),
  nowIso: "2026-07-17T10:00:00.000Z",
});
assert(tCtxOnFall.relation === "opens_new", "second fall opens new");
const tFallCtx = ingestActiveCareObservation({
  caregiverId: "cg_acs",
  rawText: "She did not hit her head.",
  kind: classifyCareEventKind("She did not hit her head."),
  nowIso: "2026-07-17T10:05:00.000Z",
});
assert(
  tFallCtx.relation === "adds_context" ||
    tFallCtx.relation === "updates_active" ||
    tFallCtx.relation === "answers_uncertainty",
  "head-safety follow-up stays on fall ACS",
);
assert(tFallCtx.situation.id === tCtxOnFall.situation.id, "head follow-up stays on fall ACS");
console.log("✓ soft that references hard safety detail may stay on hard ACS");

// False-positive hard tokens must NOT glue mood into fall ACS
for (const softTrap of [
  "shes frustrated about her headache",
  "I hurt for her shes frustrated",
  "shes frustrated at the hospital waiting room",
]) {
  resetActiveCareSituationStore();
  const fallSeed = ingestActiveCareObservation({
    caregiverId: "cg_acs_trap",
    rawText: "Mom fell yesterday. We went to urgent care.",
    kind: classifyCareEventKind("Mom fell yesterday. We went to urgent care."),
    nowIso: "2026-07-16T14:00:00.000Z",
  });
  const softTrapTurn = ingestActiveCareObservation({
    caregiverId: "cg_acs_trap",
    rawText: softTrap,
    kind: classifyCareEventKind(softTrap),
    nowIso: "2026-07-16T14:10:00.000Z",
  });
  assert(softTrapTurn.relation === "opens_new", `trap opens_new: ${softTrap}`);
  assert(softTrapTurn.situation.id !== fallSeed.situation.id, `trap new ACS: ${softTrap}`);
}
console.log("✓ soft notes with head/hurt/hospital tokens open new (no false attach)");

// entryIntent must not override server relation (soft → still update; hard → still opens_new)
resetActiveCareSituationStore();
const seed = ingestActiveCareObservation({
  caregiverId: "cg_acs_intent",
  rawText: "She's frustrated.",
  kind: classifyCareEventKind("She's frustrated."),
  nowIso: "2026-07-16T10:00:00.000Z",
});
const ignoreInitial = classifySituationRelation({
  active: getActiveCareSituation("cg_acs_intent"),
  rawText: "She's sad.",
  kind: classifyCareEventKind("She's sad."),
  nowIso: "2026-07-16T10:05:00.000Z",
  entryIntent: "initial",
});
assert(
  ignoreInitial === "updates_active" || ignoreInitial === "adds_context",
  "client entryIntent=initial must not force opens_new for soft same-day",
);
const ignoreUpdateHard = classifySituationRelation({
  active: getActiveCareSituation("cg_acs_intent"),
  rawText: "Mom fell this morning.",
  kind: classifyCareEventKind("Mom fell this morning."),
  nowIso: "2026-07-16T10:10:00.000Z",
  entryIntent: "update",
});
assert(ignoreUpdateHard === "opens_new", "client entryIntent=update must not absorb hard into soft ACS");
assert(seed.situation.id, "seed ACS exists");
console.log("✓ client entryIntent ignored — server owns relation");

// Idempotent re-ingest
resetActiveCareSituationStore();
ingestActiveCareObservation({
  caregiverId: "cg_acs_idemp",
  rawText: "Mom fell yesterday. We went to urgent care.",
  kind: classifyCareEventKind("Mom fell yesterday. We went to urgent care."),
  nowIso: "2026-07-16T18:00:00.000Z",
});
const again = ingestActiveCareObservation({
  caregiverId: "cg_acs_idemp",
  rawText: "Mom fell yesterday. We went to urgent care.",
  kind: classifyCareEventKind("Mom fell yesterday. We went to urgent care."),
  nowIso: "2026-07-16T18:00:01.000Z",
});
assert(again.situation.observations.length === 1, "idempotent — no duplicate");
console.log("✓ idempotent ingest");

assert(getActiveCareSituation("cg_acs_idemp") !== null, "active situation present before pause");
const { pauseActiveCareSituationSession } = await import("../src/lib/active-care-situation");
const pausedAcs = pauseActiveCareSituationSession("cg_acs_idemp");
assert(pausedAcs != null && getActiveCareSituation("cg_acs_idemp") != null, "Done for now persists ACS");
assert(pausedAcs!.interaction_paused_at != null, "interaction paused");
const afterPause = ingestActiveCareObservation({
  caregiverId: "cg_acs_idemp",
  rawText: "She's quieter this evening.",
  kind: classifyCareEventKind("She's quieter this evening."),
  nowIso: "2026-07-16T19:00:00.000Z",
});
assert(afterPause.relation === "opens_new", "after pause, unrelated soft can open a new situation");
assert(getActiveCareSituation("cg_acs_idemp")?.interaction_paused_at == null, "ingest resumes session");
console.log("✓ Done for now pauses session — ACS persists; next note may open related/new");

// Pipeline ingest — ACS lives in processSituationInput, not only at LCR render.
const { resetCareContextRootStore, processSituationInput } = await import(
  "../src/lib/situation-entry"
);
const { resetCareEventStore } = await import("../src/lib/care-events/store");
const { resetDareStore } = await import("../src/lib/data-acquisition-resilience");
const { resetNormalizationStore } = await import("../src/lib/event-normalization/event-normalizer");
const { resetPolicyEngineStore, seedVerifyConsent } = await import("../src/lib/policy-engine");
const { groupEventsBySituationId } = await import("../src/lib/active-care-situation/spine-link");

resetActiveCareSituationStore();
resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetNormalizationStore();
resetPolicyEngineStore();
seedVerifyConsent("cg_acs_pipeline");

const pipe1 = await processSituationInput({
  raw_input: "She's frustrated.",
  caregiver_id: "cg_acs_pipeline",
  timestamp: "2026-07-16T14:00:00.000Z",
});
assert(pipe1.active_care_situation != null, "pipeline ACS present");
assert(getActiveCareSituation("cg_acs_pipeline")?.id === pipe1.active_care_situation?.id, "store matches response");
assert(
  pipe1.events_created.every((e) => e.situation_id === pipe1.active_care_situation?.id),
  "CareEvents stamped with situation_id",
);
assert(
  pipe1.events_created.every((e) => e.root_event_id === pipe1.events_created[0]?.id),
  "opens_new: root_event_id is primary event",
);

const pipe2 = await processSituationInput({
  raw_input: "She's sad.",
  caregiver_id: "cg_acs_pipeline",
  timestamp: "2026-07-16T14:05:00.000Z",
});
assert(
  (pipe2.active_care_situation?.observations.length ?? 0) >= 2,
  "second pipeline write updates ACS observations",
);
assert(
  pipe2.events_created.every((e) => e.situation_id === pipe1.active_care_situation?.id),
  "soft update shares situation_id on CareContext spine",
);
assert(
  pipe2.events_created.every((e) => e.root_event_id === pipe1.events_created[0]?.id),
  "soft update shares root_event_id with situation root",
);
assert(
  pipe1.events_created[0]!.raw_input !== pipe2.events_created[0]!.raw_input ||
    pipe2.context.events.length >= 2,
  "soft update appends — does not merge raw text away",
);
const groups = groupEventsBySituationId(pipe2.context.events);
assert(groups.length === 1, "related soft observations form one situation group");
assert(groups[0]!.event_ids.length >= 2, "group contains both CareEvents");
console.log("✓ processSituationInput links soft updates via situation_id / root_event_id");

// Soft same-day outside window via pipeline (server relation, no client intent)
const pipeLate = await processSituationInput({
  raw_input: "She's still restless.",
  caregiver_id: "cg_acs_pipeline",
  timestamp: "2026-07-16T23:00:00.000Z",
});
assert(
  pipeLate.events_created.every((e) => e.situation_id === pipe1.active_care_situation?.id),
  "pipeline soft same-day outside 12h still shares situation_id",
);
console.log("✓ pipeline soft same-day outside window keeps situation_id");

const pipeFall = await processSituationInput({
  raw_input: "Mom fell yesterday. We went to urgent care.",
  caregiver_id: "cg_acs_pipeline",
  timestamp: "2026-07-16T23:30:00.000Z",
});
assert(
  pipeFall.events_created[0]?.situation_id !== pipe1.active_care_situation?.id,
  "hard fall opens a new situation_id on the spine",
);
assert(
  (pipeFall.care_situation_groups?.length ?? 0) >= 2,
  "care_situation_groups separates soft ACS from fall",
);
console.log("✓ hard event opens new situation_id on CareContext spine");

assert(
  fs.existsSync(path.join(process.cwd(), "scripts/verify-living-care-record-regression.mts")),
  "ACS happy path is not enough — living-care-record-regression verify must exist",
);

console.log("\n=== Active Care Situation: all checks passed ===\n");
