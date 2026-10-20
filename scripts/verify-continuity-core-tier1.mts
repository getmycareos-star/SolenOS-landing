/**
 * Continuity core Tier 1 spine — G3–G6, G12–G13, G16 (product-doc IDs).
 * Principle-based; non-illustration wording.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
  getActiveCareSituation,
} from "../src/lib/active-care-situation";
import {
  resetCareRealityStateStore,
  getCareRealityState,
} from "../src/lib/care-reality-state";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import {
  composeCaregiverResponse,
  assertComposedResponseProfessional,
} from "../src/lib/caregiver-response-composer";
import { classifyCaregiverTurn } from "../src/lib/response-behavior";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { evaluateSourceConflict, resetSourceConflictStore, sourcePriorityRank } from "../src/lib/source-conflict";
import {
  resetDecisionMemoryStore,
  listDecisionMemory,
  linkDecisionOutcome,
  answerRecordQuestion,
} from "../src/lib/decision-memory";
import { assertRealCaregiverTest } from "../src/lib/real-caregiver-test";
import {
  ingestCareThread,
  THREAD_SOURCE_EVIDENCE_PREFIX,
  listThreadSourceEvidence,
  resetThreadSourceEvidenceStore,
} from "../src/lib/thread-ingestion";
import { composePerspectiveAttribution } from "../src/lib/perspective-attribution";
import { processSituationInput } from "../src/lib/situation-entry/pipeline";
import { resetCareContextRootStore } from "../src/lib/situation-entry";
import {
  resetMultiCaregiverContextStore,
  resolveCareRealityStoreKey,
} from "../src/lib/multi-caregiver-context-model";

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetDecisionMemoryStore();
  resetSourceConflictStore();
  resetThreadSourceEvidenceStore();
  resetCareContextRootStore();
  resetMultiCaregiverContextStore();
}

function realityKeyFor(caregiverId: string): string {
  return resolveCareRealityStoreKey(caregiverId);
}

console.log("=== Continuity core Tier 1 (G3–G6 / G12–G13 / G16) ===\n");

// ——— G5 — first emotional only ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g5_emo",
    rawText: "I am exhausted.",
    kind: classifyCareEventKind("I am exhausted."),
    nowIso: "2026-07-17T02:00:00.000Z",
  });
  const turnClass = classifyCaregiverTurn({
    latestRawText: "I am exhausted.",
    kind: classifyCareEventKind("I am exhausted."),
    turn,
  });
  assert.equal(turnClass, "emotional_only", "G5 emotional_only class");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "I am exhausted.",
    kind: classifyCareEventKind("I am exhausted."),
  });
  assertComposedResponseProfessional(composed);
  assert(/Living Care Record|held|context/i.test(composed.confirmation), "G5 acknowledge");
  assert(composed.show_clarity === false, "G5 no therapy Clarity dump");
  assert(
    !/burnout score|confidence %|how does that make you feel|i'?m sorry you'?re going through/i.test(
      [composed.confirmation, ...(composed.still_unclear ?? [])].join(" "),
    ),
    "G5 no therapy / scores",
  );
  assert(
    (composed.still_unclear?.length ?? 0) >= 1 &&
      (composed.still_unclear?.length ?? 0) <= 2,
    "G5 invite care context (1–2 asks)",
  );
  console.log("✓ G5 emotional only — acknowledge + invite context");
}

// ——— G3 — new contributor, same Care Reality ———
{
  resetAll();
  const careKey = "cg_shared_person";
  ingestActiveCareObservation({
    caregiverId: careKey,
    contributorId: "contributor_daughter",
    rawText: "She refused lunch and pushed the plate away.",
    kind: classifyCareEventKind("She refused lunch and pushed the plate away."),
    nowIso: "2026-07-17T12:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    contributorId: "contributor_brother",
    rawText: "Later she seemed confused about where the bathroom was.",
    kind: classifyCareEventKind(
      "Later she seemed confused about where the bathroom was.",
    ),
    nowIso: "2026-07-17T16:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey);
  const crs = getCareRealityState(careKey);
  assert(acs != null && acs.observations.length >= 2, "G3 same ACS");
  assert(crs != null && crs.observation_count >= 2, "G3 same CRS");
  assert(
    acs!.observations.some((o) => o.contributor_id === "contributor_daughter"),
    "G3 daughter attribution",
  );
  assert(
    acs!.observations.some((o) => o.contributor_id === "contributor_brother"),
    "G3 brother attribution",
  );
  assert(turn.relation !== "opens_new" || acs!.observations.length >= 2, "G3 linked");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "Later she seemed confused about where the bathroom was.",
    kind: classifyCareEventKind(
      "Later she seemed confused about where the bathroom was.",
    ),
  });
  assertComposedResponseProfessional(composed);
  console.log("✓ G3 new contributor — same Care Reality + attribution");
}

// ——— G12 — source conflict (doc vs note) ———
{
  resetAll();
  const unit = evaluateSourceConflict({
    priorObservations: [
      {
        raw_text: "[document: discharge] Eating normally with good appetite.",
        kind: "document",
        captured_at: "2026-07-16T10:00:00.000Z",
      },
    ],
    incomingText: "She refused dinner and barely ate tonight.",
    incomingKind: "behavior_change",
    incomingCapturedAt: "2026-07-17T19:00:00.000Z",
  });
  assert(
    sourcePriorityRank("hospital_discharge") > sourcePriorityRank("appetite"),
    "G12 clinical rank > memory note",
  );
  assert(unit.has_conflict === true, "G12 unit detects conflict");
  assert(unit.both_retained === true, "G12 both retained");
  assert(
    unit.priority_for_orientation === "prior",
    "G12 clinical/document orients over later memory note",
  );
  assert(
    /clinical or document|both are held/i.test(unit.note ?? ""),
    "G12 note prefers clinical source language",
  );

  const careKey = "cg_g12";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "[document: discharge] Eating normally with good appetite.",
    kind: "document",
    nowIso: "2026-07-16T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She refused dinner and barely ate tonight.",
    kind: classifyCareEventKind("She refused dinner and barely ate tonight."),
    nowIso: "2026-07-17T19:00:00.000Z",
  });
  assert(
    turn.pattern_label === "source conflict" ||
      /both are held|do not fully agree/i.test(turn.what_changed_in_understanding ?? ""),
    "G12 conflict flagged via durable source claims",
  );
  assert(getActiveCareSituation(careKey) != null, "G12 ACS present");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "She refused dinner and barely ate tonight.",
    kind: classifyCareEventKind("She refused dinner and barely ate tonight."),
  });
  assertComposedResponseProfessional(composed);
  console.log("✓ G12 source conflict — keep both, flag, clinical/document orients");
}

// ——— G13 — record question → decision memory ———
{
  resetAll();
  const careKey = "cg_g13";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText:
      "The doctor started a blood pressure medication because readings stayed high.",
    kind: classifyCareEventKind(
      "The doctor started a blood pressure medication because readings stayed high.",
    ),
    nowIso: "2026-07-10T11:00:00.000Z",
  });
  const stored = listDecisionMemory(realityKeyFor(careKey));
  assert(stored.length >= 1, "G13 decision stored");
  const dm = stored[0]!;
  assert(dm.what.length > 0, "G13 what held");
  assert(dm.reason != null && /high/i.test(dm.reason), "G13 reason held");
  assert(dm.status === "active" || dm.status === "pending", "G13 status set");
  assert(dm.evidence.length >= 1 || dm.evidence_texts.length >= 1, "G13 evidence linked");
  assert(Array.isArray(dm.who), "G13 who array");

  const q = "Why is Mom taking this medication?";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: q,
    kind: classifyCareEventKind(q),
    nowIso: "2026-07-17T15:00:00.000Z",
  });
  const turnClass = classifyCaregiverTurn({
    latestRawText: q,
    kind: classifyCareEventKind(q),
    turn,
  });
  assert.equal(turnClass, "record_question", "G13 record_question class");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: q,
    kind: classifyCareEventKind(q),
  });
  assertComposedResponseProfessional(composed);
  assert(composed.show_clarity === false, "G13 no Clarity form");
  assert((composed.still_unclear?.length ?? 0) === 0, "G13 no forced asks when reason held");
  assert(
    (composed.what_we_know?.length ?? 0) >= 1 ||
      (composed.evidence_line != null && /Living Care Record/i.test(composed.evidence_line)),
    "G13 evidence-backed answer",
  );
  assert(
    !/fill out|complete this form|clarity triad|you should (choose|pick|select)/i.test(
      [composed.confirmation, ...(composed.what_we_know ?? [])].join(" "),
    ),
    "G13 not a form or advice",
  );
  assertRealCaregiverTest(composed, "G13 via G61 bar");
  console.log("✓ G13 record question — decision memory, not Clarity form");
}

// ——— G13b — outcome linking + unknown reason + alternatives ———
{
  resetAll();
  const careKey = "cg_g13b";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText:
      "We chose rehabilitation instead of home after the hospital stay.",
    kind: classifyCareEventKind(
      "We chose rehabilitation instead of home after the hospital stay.",
    ),
    nowIso: "2026-07-01T10:00:00.000Z",
  });
  const rk = realityKeyFor(careKey);
  let entries = listDecisionMemory(rk);
  assert(entries.length >= 1, "G13b decision stored");
  assert(
    entries[0]!.alternatives.length >= 1 || /rehab|home/i.test(entries[0]!.what),
    "G13b alternatives or choice held",
  );
  assert(entries[0]!.reason == null, "G13b reason unknown is first-class");

  linkDecisionOutcome({
    careKey: rk,
    outcomeText: "Walking confidence is still reduced after rehabilitation.",
    nowIso: "2026-07-15T10:00:00.000Z",
  });
  entries = listDecisionMemory(rk);
  assert(entries[0]!.outcome != null, "G13b outcome linked");
  assert(
    entries[0]!.status === "completed" || entries[0]!.status === "changed",
    "G13b status updated after outcome",
  );

  const answered = answerRecordQuestion({
    careKey: rk,
    question: "Why did we choose rehabilitation instead of home?",
  });
  assert(answered.answered_from_memory, "G13b answered from memory");
  assert(answered.reason_unknown, "G13b surfaces unknown reason");
  assert(
    answered.lines.some((l) => /not held|reason/i.test(l)),
    "G13b honest unknown reason line",
  );
  assert(answered.forces_clarity_form === false, "G13b never Clarity");
  assert(
    !/you should|recommend|I advise/i.test(answered.lines.join(" ")),
    "G13b no advice",
  );
  console.log("✓ G13b outcome + unknown reason + no advice");
}

// ——— G13c — unified decision signal: SRE + Decision Memory + composer why-path ———
{
  resetAll();
  const careKey = "cg_g13c";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell yesterday.",
    kind: classifyCareEventKind("Mom fell yesterday."),
    nowIso: "2026-07-10T10:00:00.000Z",
  });
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText:
      "Doctor changed her blood pressure medication because readings stayed high after the fall.",
    kind: classifyCareEventKind(
      "Doctor changed her blood pressure medication because readings stayed high after the fall.",
    ),
    nowIso: "2026-07-10T11:00:00.000Z",
    relationshipDecision: "ADD_RELATED_EVENT",
  });
  const rk = realityKeyFor(careKey);
  const stored = listDecisionMemory(rk);
  assert(stored.length >= 1, "G13c decision stored via unified signal");
  assert(/medication|changed/i.test(stored[0]!.what), "G13c decision what held");
  assert(stored[0]!.reason != null && /high/i.test(stored[0]!.reason!), "G13c reason held");

  const q = "Why is Mom taking this medication?";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: q,
    kind: classifyCareEventKind(q),
    nowIso: "2026-07-17T15:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: q,
    kind: classifyCareEventKind(q),
  });
  assertComposedResponseProfessional(composed);
  const blob = [
    ...(composed.what_we_know ?? []),
    composed.evidence_line ?? "",
    composed.situation_summary ?? "",
  ].join(" ");
  assert(/medication|changed|reason|fall/i.test(blob), "G13c composer surfaces why-path from held decision");
  assert(composed.show_clarity === false, "G13c no Clarity form on record question");
  console.log("✓ G13c unified decision signal — memory + composer why-path");
}

// ——— G4 — document only ———
{
  resetAll();
  const careKey = "cg_g4_doc";
  const extract =
    "[document: discharge] Mom was discharged home. Appetite noted as fair. Follow-up with primary care in one week.";
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: extract,
    kind: "document",
    nowIso: "2026-07-17T11:00:00.000Z",
  });
  assert(getActiveCareSituation(careKey) != null, "G4 ACS from document");
  assert(getCareRealityState(careKey) != null, "G4 CRS from document");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: extract,
    kind: "document",
    hasDocuments: true,
  });
  assertComposedResponseProfessional(composed);
  assert(/Living Care Record|document/i.test(composed.confirmation), "G4 person/journey confirmation");
  assert((composed.still_unclear?.length ?? 0) <= 3, "G4 ≤3 asks");
  assert(
    !/ocr|extraction pipeline|document analyzer|extracted fields|parsing complete|confidence %/i.test(
      [
        composed.confirmation,
        composed.evidence_line ?? "",
        ...(composed.what_we_know ?? []),
        ...(composed.still_unclear ?? []),
      ].join(" "),
    ),
    "G4 no analyzer chrome",
  );
  assert(composed.show_clarity === false, "G4 no forced Clarity dump");
  console.log("✓ G4 document only — same pipeline, no analyzer chrome");
}

// ——— G6 — long thread → multiple linked events ———
{
  resetAll();
  const careKey = "cg_g6_thread";
  const thread = `Alex: Mom fell in the hallway this morning.
Sam: They went to urgent care after.
Alex: The doctor stopped one of her evening pills.
Sam: Now she says she is afraid to walk to the kitchen.`;
  const result = ingestCareThread({
    caregiverId: careKey,
    rawThread: thread,
    nowIso: "2026-07-17T18:00:00.000Z",
  });
  assert(result.is_chat_summary === false, "G6 not chat-summary product");
  assert(result.multiple_linked_events === true, "G6 multiple fragments");
  assert(result.fragments.length >= 3, "G6 several care-relevant fragments");
  assert(result.source_preserved.includes("fell"), "G6 source preserved");
  const acs = getActiveCareSituation(careKey);
  assert(acs != null && acs.observations.length >= 2, "G6 linked ACS observations");
  assert(
    acs!.observations.some((o) => o.raw_text.includes(THREAD_SOURCE_EVIDENCE_PREFIX)),
    "G6 original thread pointer stored",
  );
  assert(
    !acs!.observations.some((o) => /\[thread-source\]/.test(o.human_fact)),
    "G6 human_fact is fragment only — never thread dump",
  );
  const durable = listThreadSourceEvidence(careKey);
  assert(
    durable.some((t) => t.source_text.includes("fell") && t.source_text.includes("afraid")),
    "G6 full source durable (not truncated)",
  );
  const kinds = new Set(acs!.observations.map((o) => o.kind));
  assert(kinds.size >= 2, "G6 per-fragment kinds — not one kind for whole thread");
  const last = result.turns[result.turns.length - 1]!;
  const composed = composeCaregiverResponse({
    turn: last,
    latestRawText: result.fragments[result.fragments.length - 1]!,
    kind: classifyCareEventKind(result.fragments[result.fragments.length - 1]!),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/chat summary|here is a summary of the conversation|tl;dr/i.test(
      [composed.confirmation, composed.situation_summary ?? ""].join(" "),
    ),
    "G6 must not present as chat summary",
  );

  // Live path: processSituationInput must grow ACS (not one flattened observation).
  resetAll();
  const liveKey = "cg_g6_live";
  await processSituationInput({
    raw_input: thread,
    caregiver_id: liveKey,
    timestamp: "2026-07-17T18:00:00.000Z",
  });
  const liveAcs = getActiveCareSituation(liveKey);
  assert(
    (liveAcs?.observations.length ?? 0) >= 2,
    "G6 live pipeline → multiple ACS observations (Locked B)",
  );
  assert(
    listThreadSourceEvidence(liveKey).some((t) => t.source_text.includes(thread.split("\n")[0]!)),
    "G6 live pipeline preserves full source thread",
  );
  console.log("✓ G6 long thread — multiple linked events, source preserved");
}

// ——— G16 — contradictory views + visible attribution ———
{
  resetAll();
  const careKey = "cg_g16_views";
  ingestActiveCareObservation({
    caregiverId: careKey,
    contributorId: "contributor_daughter",
    rawText: "She ate normally at lunch today.",
    kind: classifyCareEventKind("She ate normally at lunch today."),
    nowIso: "2026-07-17T12:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    contributorId: "contributor_son",
    rawText: "She barely ate dinner and pushed the plate away.",
    kind: classifyCareEventKind("She barely ate dinner and pushed the plate away."),
    nowIso: "2026-07-17T19:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey)!;
  assert(acs.observations.length >= 2, "G16 both observations retained");
  const perspectives = composePerspectiveAttribution({
    situation: acs,
    patternLabel: turn.pattern_label,
  });
  assert(perspectives.silent_winner === false, "G16 no silent winner");
  assert(perspectives.show === true, "G16 attribution shown");
  assert(
    /Daughter|Son|Different views/i.test(perspectives.evidence_line ?? ""),
    "G16 who-said visible",
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "She barely ate dinner and pushed the plate away.",
    kind: classifyCareEventKind("She barely ate dinner and pushed the plate away."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    /Different views|Daughter:|Son:|both kept|more than one view/i.test(
      [
        composed.evidence_line ?? "",
        composed.situation_summary ?? "",
        ...(composed.what_we_know ?? []),
      ].join(" "),
    ),
    "G16 composer surfaces perspectives",
  );
  assert(!/chat feed|message thread from/i.test(composed.evidence_line ?? ""), "G16 not a chat feed");
  console.log("✓ G16 contradictory views — attribution visible, both kept");
}

console.log("\n=== Continuity core Tier 1: all checks passed ===\n");
