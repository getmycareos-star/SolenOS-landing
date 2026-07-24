/**
 * verify-caregiver-response-composer.mts
 * Trust-critical Response Contract (ADR-022) — golden scenarios G1–G5.
 * Composer is sole authority; panel disclosure gates; no interview quiz.
 */

import {
  assertComposedResponseProfessional,
  composeCaregiverResponse,
  CAREGIVER_RESPONSE_BANNED_PHRASES,
} from "../src/lib/caregiver-response-composer";
import {
  getActiveCareSituation,
  pauseActiveCareSituationSession,
  clearActiveCareSituation,
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { getCareRealityState } from "../src/lib/care-reality-state";
import {
  classifyCareEventKind,
  buildLivingCareRecordResponse,
} from "../src/lib/living-care-record-ux";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { buildContinuityHomeView } from "../src/lib/mvp-surface-area";
import { isCaregiverFacingAsk } from "../src/lib/progressive-understanding/questions";
import {
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";
import {
  classifyCaregiverTurn,
  evidenceMaturityFor,
} from "../src/lib/response-behavior";
import fs from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function resetAll(caregiverId: string): void {
  resetActiveCareSituationStore();
  resetCareContextRootStore();
  resetCareEventStore();
  resetDareStore();
  resetNormalizationStore();
  resetPolicyEngineStore();
  resetCareRecipientIdentityStore();
  seedVerifyConsent(caregiverId);
}

console.log("=== SolenOS Caregiver Response Contract (ADR-022) ===\n");

assert(CAREGIVER_RESPONSE_BANNED_PHRASES.length >= 5, "banned list present");
assert(
  fs.existsSync(path.join(process.cwd(), "docs/02-product/caregiver-response-contract.md")),
  "Response Contract product SoT",
);
assert(
  fs.existsSync(
    path.join(process.cwd(), "docs/15-architecture-decisions/ADR-022-caregiver-response-contract.md"),
  ),
  "ADR-022",
);
console.log("✓ contract docs present");

// ——— G1: First soft note — held + facts; no Clarity triad; no quiz ———
resetActiveCareSituationStore();
const g1Turn = ingestActiveCareObservation({
  caregiverId: "cg_g1",
  rawText: "shes not feeling well and im confused",
  kind: classifyCareEventKind("shes not feeling well and im confused"),
  nowIso: "2026-07-16T14:00:00.000Z",
});
const g1 = composeCaregiverResponse({
  turn: g1Turn,
  latestRawText: "shes not feeling well and im confused",
  kind: classifyCareEventKind("shes not feeling well and im confused"),
});
assertComposedResponseProfessional(g1);
assert(g1Turn.disclosure_stage === "early", "G1 early disclosure");
assert(g1.show_clarity === false, "G1 no Clarity triad on early soft note");
assert(g1.what_matters_now == null, "G1 no what matters yet");
assert(g1.still_unclear.length <= 1, "G1 at most one calm invite — not a quiz");
assert(
  !g1.still_unclear.some((q) => /head|fluid|walking normally|usually eat/i.test(q)),
  "G1 no keyword quiz",
);
assert(/held|Living Care Record/i.test(g1.confirmation), "G1 held confirmation");
assert(g1.what_we_know.length >= 1, "G1 has facts");
console.log("✓ G1 first soft note — held + facts, no quiz, no Clarity");

// ——— G2: Related sad update — connected; Clarity when growing; still no quiz ———
const g2Turn = ingestActiveCareObservation({
  caregiverId: "cg_g1",
  rawText: "shes sad",
  kind: classifyCareEventKind("shes sad"),
  nowIso: "2026-07-16T14:05:00.000Z",
});
const g2 = composeCaregiverResponse({
  turn: g2Turn,
  latestRawText: "shes sad",
  kind: classifyCareEventKind("shes sad"),
});
assertComposedResponseProfessional(g2);
assert(g2Turn.disclosure_stage === "early", "G2 soft related update stays early (no auto Clarity)");
assert(g2.show_clarity === false, "G2 no Clarity triad on soft note #2");
assert(g2.still_unclear.length <= 3, "G2 at most ≤3 gap asks while gather incomplete");
assert(
  !g2.still_unclear.some((q) => /head|fluid|walking normally|usually eat/i.test(q)),
  "G2 no keyword quiz",
);
assert(/Connected|Updated|held/i.test(g2.confirmation), "G2 continuity confirmation");
console.log("✓ G2 related update — held + facts, no Clarity dump, no keyword quiz");

// ——— G3: Improvement — current better; omit seriousness; zero asks ———
const g3Turn = ingestActiveCareObservation({
  caregiverId: "cg_g1",
  rawText: "shes feeling well now and happy.",
  kind: classifyCareEventKind("shes feeling well now and happy."),
  nowIso: "2026-07-16T14:10:00.000Z",
});
const g3 = composeCaregiverResponse({
  turn: g3Turn,
  latestRawText: "shes feeling well now and happy.",
  kind: classifyCareEventKind("shes feeling well now and happy."),
});
assertComposedResponseProfessional(g3);
assert(g3.is_improvement, "G3 detects improvement");
assert(g3.what_may_become_serious == null, "G3 no scare");
assert(g3.still_unclear.length === 0, "G3 no quiz");
assert(
  /well|happy|held|latest|current|Updated|feeling/i.test(
    `${g3.confirmation} ${g3.what_matters_now ?? ""} ${g3.situation_summary ?? ""} ${g3.what_we_know.join(" ")} ${g3.what_changed ?? ""}`,
  ),
  "G3 orients from held improvement note — not distress",
);
assert(
  !/feeling better now\. That is the current picture|sort it alone|carry it alone/i.test(
    `${g3.what_matters_now} ${g3.situation_summary} ${g3.confirmation}`,
  ),
  "G3 no wellness theater defaults",
);
assert(
  !/distressed|emotional distress|worth watching/i.test(
    `${g3.what_matters_now} ${g3.situation_summary} ${g3.what_we_know.join(" ")}`,
  ),
  "G3 no distress framing",
);
console.log("✓ G3 improvement — professional current state");

// ——— G4: Hard event — held + fact; no kind-template quiz (not fall → head) ———
resetActiveCareSituationStore();
const g4Turn = ingestActiveCareObservation({
  caregiverId: "cg_g4",
  rawText: "Mom fell yesterday. We went to urgent care.",
  kind: classifyCareEventKind("Mom fell yesterday. We went to urgent care."),
  nowIso: "2026-07-16T15:00:00.000Z",
});
const g4 = composeCaregiverResponse({
  turn: g4Turn,
  latestRawText: "Mom fell yesterday. We went to urgent care.",
  kind: "fall",
});
assertComposedResponseProfessional(g4);
assert(
  !g4.still_unclear.some((q) => /head|walking normally/i.test(q)),
  "G4 no fall→head template quiz",
);
assert(g4.still_unclear.length === 1, "G4: one high-value ask while gaps remain");
assert(g4.show_clarity === true, "G4 hard event → light Response Contract orientation");
assert(g4.what_matters_now != null, "G4 what matters now");
assert(g4.what_can_wait != null, "G4 what can wait");
assert(/held|Living Care Record|Beginning/i.test(g4.confirmation), "G4 held");
console.log("✓ G4 hard event — orientation + Step1 ask, no kind-template quiz");

// ——— G4b: Soft after fall must NOT keep fall Clarity ———
const g4bTurn = ingestActiveCareObservation({
  caregiverId: "cg_g4",
  rawText: "shes frustrated",
  kind: classifyCareEventKind("shes frustrated"),
  nowIso: "2026-07-16T15:10:00.000Z",
});
assert(g4bTurn.relation === "opens_new", "soft mood after fall opens new situation");
const g4b = composeCaregiverResponse({
  turn: g4bTurn,
  latestRawText: "shes frustrated",
  kind: classifyCareEventKind("shes frustrated"),
});
assertComposedResponseProfessional(g4b);
assert(
  !/Connected to what you already shared/i.test(g4b.confirmation),
  "soft after fall must not claim continuity with fall",
);
assert(/held|Living Care Record/i.test(g4b.confirmation), "soft after fall: held confirmation");
assert(
  !/head injury|trouble walking after a fall|Confirm they are safe/i.test(
    `${g4b.what_matters_now ?? ""} ${g4b.what_may_become_serious ?? ""} ${g4b.what_can_wait ?? ""}`,
  ),
  "soft after fall must not show fall Clarity",
);
assert(g4b.still_unclear.length <= 3, "soft after fall: ≤3 gap asks if gather incomplete");
assert(
  !g4b.still_unclear.some((q) => /head|walking normally|hit their head/i.test(q)),
  "soft after fall: no head quiz",
);
assert(!g4b.show_clarity, "soft after fall early: no Clarity dump");
console.log("✓ G4b soft after hard event — no hard Clarity bleed");

// ——— G4c: Soft after medication — any messy mood, not fall-centric ———
resetActiveCareSituationStore();
ingestActiveCareObservation({
  caregiverId: "cg_g4c",
  rawText: "Doctor changed her blood pressure pill today.",
  kind: classifyCareEventKind("Doctor changed her blood pressure pill today."),
  nowIso: "2026-07-16T15:00:00.000Z",
});
const g4cTurn = ingestActiveCareObservation({
  caregiverId: "cg_g4c",
  rawText: "Mom wasn't herself today",
  kind: classifyCareEventKind("Mom wasn't herself today"),
  nowIso: "2026-07-16T15:20:00.000Z",
});
assert(
  g4cTurn.relation === "opens_new" ||
    g4cTurn.relation === "answers_uncertainty" ||
    g4cTurn.relation === "updates_active" ||
    g4cTurn.relation === "adds_context",
  "messy soft after med stays on Care Reality path",
);
const g4c = composeCaregiverResponse({
  turn: g4cTurn,
  latestRawText: "Mom wasn't herself today",
  kind: classifyCareEventKind("Mom wasn't herself today"),
});
assertComposedResponseProfessional(g4c);
assert(
  !/medication|recommended|side effects|Confirm they are safe|head injury/i.test(
    `${g4c.what_matters_now ?? ""} ${g4c.what_may_become_serious ?? ""} ${g4c.what_can_wait ?? ""}`,
  ),
  "messy soft after med must not show med/fall Clarity",
);
assert(
  !g4c.still_unclear.some((q) => /head|fluid|side effect|walking normally/i.test(q)),
  "messy soft: no keyword quiz",
);
assert(g4c.still_unclear.length <= 3, "messy soft: ≤3 gap asks if any");
console.log("✓ G4c messy soft after med — no hard Clarity bleed");

// ——— G4d: "started crying" is not a medication event ———
assert(
  classifyCareEventKind("She started crying") === "behavior_change",
  "started crying is behavior",
);
console.log("✓ G4d started crying is not medication");

// ——— G5: Done for now pauses session — ACS + CRS persist ———
resetActiveCareSituationStore();
ingestActiveCareObservation({
  caregiverId: "cg_g5",
  rawText: "Mom seems frustrated.",
  kind: classifyCareEventKind("Mom seems frustrated."),
  nowIso: "2026-07-16T16:00:00.000Z",
});
assert(getActiveCareSituation("cg_g5") != null, "G5 ACS open");
assert(getCareRealityState("cg_g5") != null, "G5 CRS open");
const beforePauseLifecycle = getActiveCareSituation("cg_g5")?.lifecycle_status;
const paused = pauseActiveCareSituationSession("cg_g5");
assert(paused != null, "G5 pause returns ACS");
assert(getActiveCareSituation("cg_g5") != null, "G5 ACS persists after pause");
assert(getCareRealityState("cg_g5") != null, "G5 CRS persists after pause");
assert(paused!.interaction_paused_at != null, "G5 interaction_paused_at set");
assert(
  paused!.lifecycle_status !== "resolved" && paused!.lifecycle_status !== "historical",
  "G5 Done must not resolve or historize ACS",
);
assert(
  paused!.lifecycle_status === beforePauseLifecycle,
  "G5 Done must not flip lifecycle — session pause only",
);
// clearActiveCareSituation remains for tests / hard reset only — not Done for now
clearActiveCareSituation("cg_g5");
assert(getActiveCareSituation("cg_g5") == null, "hard clear still works");
console.log("✓ G5 Done for now — pause persists ACS + CRS");

// ——— Pipeline + LCR view + Continuity Home gates ———
resetAll("cg_crc_pipe");
await processSituationInput({
  raw_input: "Mom seems frustrated.",
  caregiver_id: "cg_crc_pipe",
  timestamp: "2026-07-16T14:00:00.000Z",
});
await processSituationInput({
  raw_input: "She's sad.",
  caregiver_id: "cg_crc_pipe",
  timestamp: "2026-07-16T14:05:00.000Z",
});
const p3 = await processSituationInput({
  raw_input: "shes feeling well now and happy.",
  caregiver_id: "cg_crc_pipe",
  timestamp: "2026-07-16T14:10:00.000Z",
});
const view = buildLivingCareRecordResponse({
  response: p3,
  rawInput: "shes feeling well now and happy.",
});
assert(view.what_may_become_serious == null, "LCR view no scare");
assert(view.what_needs_context.length === 0, "LCR view no quiz");
assert(view.disclosure_plan.show_questions === false, "LCR plan hides questions");
assert(
  /better|well|happy|current|held|Updated/i.test(
    `${view.what_matters_now ?? ""} ${view.what_seems_happening ?? ""} ${view.care_event_added.confirmation}`,
  ),
  "LCR view current state",
);
const blob = [
  view.care_event_added.confirmation,
  view.what_matters_now ?? "",
  view.what_can_wait ?? "",
  view.what_may_become_serious ?? "",
  view.what_changed_in_understanding ?? "",
  view.what_seems_happening ?? "",
  ...view.what_understood,
  ...view.what_needs_context,
].join("\n");
for (const phrase of CAREGIVER_RESPONSE_BANNED_PHRASES) {
  assert(!blob.toLowerCase().includes(phrase.toLowerCase()), `banned: ${phrase}`);
}
console.log("✓ pipeline + LCR view passes composer gates");

const home = buildContinuityHomeView({
  caregiver_id: "cg_crc_pipe",
  response: p3,
  attention_event_ids: [],
});
assert(home.reflection_prompt == null, "Continuity Home: no interview prompt");
assert(
  home.needs_attention.unresolved_questions.every((q) => isCaregiverFacingAsk(q)),
  "Continuity Home: caregiver-facing asks only",
);
assert(home.needs_attention.unresolved_questions.length <= 1, "Continuity Home: max one ask");
assert(home.needs_attention.pending_follow_ups.length === 0, "Continuity Home: no follow-up quiz");
console.log("✓ Continuity Home gated to Response Contract");

// Early soft LCR: no Clarity in plan
resetAll("cg_early");
const early = await processSituationInput({
  raw_input: "shes not feeling well and im confused",
  caregiver_id: "cg_early",
  timestamp: "2026-07-16T17:00:00.000Z",
});
const earlyView = buildLivingCareRecordResponse({
  response: early,
  rawInput: "shes not feeling well and im confused",
});
assert(earlyView.disclosure_stage === "early", "early stage");
assert(earlyView.disclosure_plan.show_what_matters_now === false, "early: no Clarity in plan");
assert(earlyView.what_matters_now == null, "early: null matters");
assert(earlyView.what_needs_context.length <= 1, "early soft mood: at most one calm invite");
assert(
  !earlyView.what_needs_context.some((q) => /head|fluid|walking normally/i.test(q)),
  "early soft mood: no keyword quiz",
);
console.log("✓ early soft LCR view obeys disclosure");

// ——— G7: Messy care fact — light orientation + ≤1 ask; never topic keyword quiz ———
resetAll("cg_appetite_gather");
const g7Turn = ingestActiveCareObservation({
  caregiverId: "cg_appetite_gather",
  rawText: "he refused to eat",
  kind: classifyCareEventKind("he refused to eat"),
  nowIso: "2026-07-16T19:00:00.000Z",
});
const g7 = composeCaregiverResponse({
  turn: g7Turn,
  latestRawText: "he refused to eat",
  kind: classifyCareEventKind("he refused to eat"),
});
assertComposedResponseProfessional(g7);
assert(g7.show_clarity === true, "G7 orientable care → light Response Contract orientation");
assert(g7.what_matters_now != null, "G7 what matters now");
assert(g7.what_can_wait != null, "G7 what can wait");
assert(g7.still_unclear.length === 1, "G7: one high-value ask while gaps remain");
assert(g7.what_we_know.length >= 1, "G7 facts held with invite");
assert(
  !g7.still_unclear.some((q) => /head|fluid|walking normally|fall witnessed|usually eat/i.test(q)),
  "G7 no topic keyword quiz",
);
assert(/held|Living Care Record|Beginning/i.test(g7.confirmation), "G7 held confirmation");
console.log("✓ G7 messy care fact — orientation + ask, no keyword quiz");
const g7bTurn = ingestActiveCareObservation({
  caregiverId: "cg_appetite_gather",
  rawText: "he refused to eat",
  kind: classifyCareEventKind("he refused to eat"),
  nowIso: "2026-07-16T19:05:00.000Z",
});
const g7b = composeCaregiverResponse({
  turn: g7bTurn,
  latestRawText: "he refused to eat",
  kind: classifyCareEventKind("he refused to eat"),
});
assertComposedResponseProfessional(g7b);
assert(
  !g7b.still_unclear.some((q) => /head|fluid|walking normally|fall witnessed/i.test(q)),
  "G7b still no topic keyword quiz",
);
console.log("✓ G7b related note — still no keyword quiz");

// ——— G8: Pushback “I just told you” — never re-ask ———
resetAll("cg_pushback");
ingestActiveCareObservation({
  caregiverId: "cg_pushback",
  rawText: "he refused to eat",
  kind: classifyCareEventKind("he refused to eat"),
  nowIso: "2026-07-16T20:00:00.000Z",
});
const g8Turn = ingestActiveCareObservation({
  caregiverId: "cg_pushback",
  rawText: "i said i just told you that",
  kind: classifyCareEventKind("i said i just told you that"),
  nowIso: "2026-07-16T20:05:00.000Z",
});
const g8 = composeCaregiverResponse({
  turn: g8Turn,
  latestRawText: "i said i just told you that",
  kind: classifyCareEventKind("i said i just told you that"),
});
assertComposedResponseProfessional(g8);
assert(/Understood|will not ask/i.test(g8.confirmation), "G8 acknowledges pushback");
assert(g8.still_unclear.length === 0, "G8 zero re-asks");
assert(
  !g8.still_unclear.some((q) => /usually eat|fluids/i.test(q)),
  "G8 must not repeat gather questions",
);
// Pushback stops asks even when gather incomplete; Clarity only if understanding sufficient
assert(
  g8.show_clarity === false || g8.what_matters_now != null,
  "G8 Clarity only when understanding sufficient",
);
assert(
  !/are fluids going down|usually eat|stay with that|doing well right now/i.test(
    g8.what_matters_now ?? "",
  ),
  "G8 Clarity must not re-ask or invent wellness theater",
);
console.log("✓ G8 pushback — heard, no repeated ask");

// ——— G6: Guidance demand after held notes — Continuity Demand, not topic keyword Clarity ———
resetAll("cg_guidance");
ingestActiveCareObservation({
  caregiverId: "cg_guidance",
  rawText: "hi, im jennifer,my dad refused to eat today.im worried",
  kind: classifyCareEventKind("hi, im jennifer,my dad refused to eat today.im worried"),
  nowIso: "2026-07-16T18:00:00.000Z",
});
ingestActiveCareObservation({
  caregiverId: "cg_guidance",
  rawText: "This is new for him. He drank a little water.",
  kind: classifyCareEventKind("This is new for him. He drank a little water."),
  nowIso: "2026-07-16T18:03:00.000Z",
});
const g6Turn = ingestActiveCareObservation({
  caregiverId: "cg_guidance",
  rawText: "what should i do",
  kind: classifyCareEventKind("what should i do"),
  nowIso: "2026-07-16T18:05:00.000Z",
});
const g6 = composeCaregiverResponse({
  turn: g6Turn,
  latestRawText: "what should i do",
  kind: classifyCareEventKind("what should i do"),
});
assertComposedResponseProfessional(g6);
assert(
  g6Turn.relation === "updates_active" || g6Turn.relation === "adds_context",
  "G6 guidance stays on active situation",
);
assert(/blank page|held|memory|already held|Connected|Updated|stays connected/i.test(g6.confirmation), "G6 relief confirmation");
assert(g6.show_clarity === true, "G6 Clarity orients from held care (relief)");
assert(g6.what_matters_now != null, "G6 matters now present");
assert(
  !/head injury|fluids going down|still refusing food/i.test(g6.what_matters_now ?? ""),
  "G6 no topic keyword Clarity template",
);
assert(g6.what_can_wait != null, "G6 what can wait present");
assert(
  !/solenos orients|notice whether today's changes are new/i.test(
    `${g6.confirmation} ${g6.what_changed ?? ""} ${g6.what_matters_now ?? ""}`,
  ),
  "G6 no meta or vague Clarity",
);
assert(
  !g6.what_we_know.some((f) => /what should i do/i.test(f)),
  "G6 must not list the question as a care fact",
);
assert(
  !g6.what_we_know.some((f) => /your dad:\s*what should/i.test(f)),
  "G6 must not invent Dad facts from the question",
);
assert(
  !g6.what_we_know.some((f) => /^Earlier:/i.test(f)),
  "G6 facts are present tense held state, not archival Earlier:",
);
const g6Pipe = await processSituationInput({
  raw_input: "what should i do",
  caregiver_id: "cg_guidance",
  timestamp: "2026-07-16T18:06:00.000Z",
});
const g6Lcr = buildLivingCareRecordResponse({
  response: g6Pipe,
  rawInput: "what should i do",
});
assert(
  !g6Lcr.what_understood.some((f) => /what should i do/i.test(f)),
  "G6 LCR: no question-as-fact",
);
assert(g6Lcr.show_attention_sections === true, "G6 LCR: Clarity orientation shown");
assert(g6Lcr.what_matters_now != null, "G6 LCR matters now present");
assert(
  !/head injury|fluids going down|still refusing food/i.test(g6Lcr.what_matters_now ?? ""),
  "G6 LCR no topic keyword Clarity template",
);
assert(
  !/what should i do/i.test(g6Lcr.what_understood.join(" ")),
  "G6 LCR still no question-as-fact",
);
console.log("✓ G6 guidance demand — orientation relief from held care, no invented Dad question-fact");

// ——— G14: Same words, no dementia decline assumption ———
resetAll("cg_g14");
ingestActiveCareObservation({
  caregiverId: "cg_g14",
  rawText: "Busy day with visitors; Mom is tired.",
  kind: classifyCareEventKind("Busy day with visitors; Mom is tired."),
  nowIso: "2026-07-17T10:00:00.000Z",
});
const g14Turn = ingestActiveCareObservation({
  caregiverId: "cg_g14",
  rawText: "Mom is sleeping a lot.",
  kind: classifyCareEventKind("Mom is sleeping a lot."),
  nowIso: "2026-07-17T14:00:00.000Z",
});
const g14 = composeCaregiverResponse({
  turn: g14Turn,
  latestRawText: "Mom is sleeping a lot.",
  kind: classifyCareEventKind("Mom is sleeping a lot."),
});
assertComposedResponseProfessional(g14);
assert(
  !/dementia progression|normal dementia|typical dementia|means dementia|sleeping more means/i.test(
    [g14.confirmation, g14.what_changed, g14.what_is_happening, ...(g14.what_we_know ?? [])].join(
      " ",
    ),
  ),
  "G14 no dementia/decline assumption",
);
assert(g14Turn.crs_observation_count >= 2, "G14 CRS observation count tracks");
console.log("✓ G14 context-not-keywords — no dementia progression assumption");

// ——— G19: Empty / low-value input ———
resetAll("cg_g19");
ingestActiveCareObservation({
  caregiverId: "cg_g19",
  rawText: "Mom seemed unsettled this morning.",
  kind: classifyCareEventKind("Mom seemed unsettled this morning."),
  nowIso: "2026-07-17T09:00:00.000Z",
});
const g19Turn = ingestActiveCareObservation({
  caregiverId: "cg_g19",
  rawText: "Nothing new",
  kind: classifyCareEventKind("Nothing new"),
  nowIso: "2026-07-17T12:00:00.000Z",
});
const g19Class = classifyCaregiverTurn({
  latestRawText: "Nothing new",
  kind: classifyCareEventKind("Nothing new"),
  turn: g19Turn,
});
assert(g19Class === "empty_or_thin", "G19 turn class empty_or_thin");
const g19 = composeCaregiverResponse({
  turn: g19Turn,
  latestRawText: "Nothing new",
  kind: classifyCareEventKind("Nothing new"),
});
assertComposedResponseProfessional(g19);
assert(/nothing new was added/i.test(g19.confirmation), "G19 no hallucinated event");
assert(g19.show_clarity === false, "G19 no forced Clarity workflow");
console.log("✓ G19 empty input — no hallucinated work");

// ——— Identity naming: durable display name in confirmation ———
resetAll("cg_name");
const nameRealityKey = resolveCareRealityStoreKey("cg_name");
setCareRecipientDisplayName({ careKey: nameRealityKey, displayName: "Grandma" });
const nameTurn = ingestActiveCareObservation({
  caregiverId: "cg_name",
  rawText: "She seemed quieter after lunch.",
  kind: classifyCareEventKind("She seemed quieter after lunch."),
  nowIso: "2026-07-17T13:00:00.000Z",
});
assert(nameTurn.situation.subject_label === "Grandma", "durable display name on ACS");
const named = composeCaregiverResponse({
  turn: nameTurn,
  latestRawText: "She seemed quieter after lunch.",
  kind: classifyCareEventKind("She seemed quieter after lunch."),
});
assert(/Grandma/i.test(named.confirmation), "confirmation uses ask-once name");
console.log("✓ Identity naming — ask-once display name in composer");

// ——— G17: Identity mismatch — one soft ask; no care-story chrome ———
resetAll("cg_g17");
setCareRecipientDisplayName({
  careKey: resolveCareRealityStoreKey("cg_g17"),
  displayName: "Mom",
});
ingestActiveCareObservation({
  caregiverId: "cg_g17",
  rawText: "Mom fell yesterday.",
  kind: classifyCareEventKind("Mom fell yesterday."),
  nowIso: "2026-07-16T10:00:00.000Z",
});
const g17Turn = ingestActiveCareObservation({
  caregiverId: "cg_g17",
  rawText: "Dad had a doctor's appointment today.",
  kind: classifyCareEventKind("Dad had a doctor's appointment today."),
  nowIso: "2026-07-16T11:00:00.000Z",
});
const g17 = composeCaregiverResponse({
  turn: g17Turn,
  latestRawText: "Dad had a doctor's appointment today.",
  kind: classifyCareEventKind("Dad had a doctor's appointment today."),
});
assertComposedResponseProfessional(g17);
assert(g17Turn.identity_mismatch === true, "G17 turn flagged");
assert(g17.still_unclear.length === 1, "G17 exactly one ask");
assert(/dad|someone else/i.test(g17.still_unclear[0] ?? ""), "G17 identity clarification ask");
assert(g17.care_story_update == null, "G17 no care story update");
assert(g17.connection_note == null, "G17 no fake connection");
assert(!/added to .* care story/i.test(g17.confirmation), "G17 no Added to care story");
assert(g17.show_clarity === false, "G17 no Clarity triad");
console.log("✓ G17 identity mismatch — one soft ask, no care-story theater");

// ——— Evidence maturity from CRS ———
resetAll("cg_ev");
const ev1 = ingestActiveCareObservation({
  caregiverId: "cg_ev",
  rawText: "Mom skipped breakfast.",
  kind: classifyCareEventKind("Mom skipped breakfast."),
  nowIso: "2026-07-17T08:00:00.000Z",
});
assert(
  evidenceMaturityFor({ turn: ev1, turnClass: "observation" }) === 1,
  "L1 first observation",
);
const ev2 = ingestActiveCareObservation({
  caregiverId: "cg_ev",
  rawText: "She only sipped water at lunch.",
  kind: classifyCareEventKind("She only sipped water at lunch."),
  nowIso: "2026-07-17T12:00:00.000Z",
});
assert(ev2.crs_revision >= 2, "CRS revision advances");
assert(
  evidenceMaturityFor({ turn: ev2, turnClass: "observation" }) >= 2,
  "L2+ after second observation",
);
const crs = getCareRealityState("cg_ev");
assert(crs != null && crs.observation_count === ev2.crs_observation_count, "CRS counts align");
console.log("✓ Evidence maturity from CRS observation/revision");

console.log("\n=== Caregiver Response Contract: all checks passed ===\n");
