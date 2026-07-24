/**
 * verify-situation-relationship-engine.mts
 * Golden spine scenarios for Situation Relationship Engine (G2, G14–G17, G15).
 * Behavior — not phrase templates.
 */

import { evaluateSituationRelationship } from "../src/lib/situation-relationship-engine";
import { looksLikeCareDecision } from "../src/lib/situation-relationship-engine";
import { looksLikeDecisionEvidence } from "../src/lib/decision-memory";
import type { ActiveCareSituation } from "../src/lib/active-care-situation/types";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux/event-clarifiers";
import {
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function stubAcs(partial: Partial<ActiveCareSituation> & Pick<ActiveCareSituation, "id" | "subject_label" | "theme">): ActiveCareSituation {
  const now = new Date().toISOString();
  return {
    caregiver_id: "verify_sre",
    opened_at: now,
    updated_at: now,
    root_event_id: "ev_root",
    observations: [
      {
        id: "obs1",
        raw_text: "Mom fell yesterday.",
        human_fact: "Mom fell yesterday.",
        kind: "fall",
        captured_at: now,
        event_ids: ["ev_root"],
      },
    ],
    open_questions: ["Did she hit her head?"],
    asked_questions: [],
    understanding_stage: "gathering",
    connection_note: null,
    synthesis: null,
    what_matters_now: null,
    ...partial,
  };
}

console.log("=== Situation Relationship Engine ===\n");

const now = new Date().toISOString();

// Unified decision signal — SRE and Decision Memory must agree
{
  const phrase = "Doctor changed her medication after the fall.";
  assert(looksLikeCareDecision(phrase), "unified: SRE decision signal");
  assert(looksLikeDecisionEvidence(phrase), "unified: Decision Memory signal");
  const improvement = "She ate better today.";
  assert(!looksLikeDecisionEvidence(improvement), "unified: improvement not a decision");
  console.log("Unified decision signal OK");
}

// G15 reinforcement
{
  const active = stubAcs({ id: "acs_fall", subject_label: "Mom", theme: "incident" });
  const ev = evaluateSituationRelationship({
    active,
    rawText: "Just reminding you Mom fell yesterday.",
    kind: classifyCareEventKind("Just reminding you Mom fell yesterday."),
    nowIso: now,
  });
  assert(ev.is_reinforcement, "G15: reinforcement detected");
  assert(ev.acs_relation === "updates_active", "G15: updates active, not opens_new");
  assert(ev.related_situation_id === "acs_fall", "G15: same situation id");
  console.log("G15 reinforcement OK");
}

// G15 ingest — restated concern must not inflate observation count
{
  resetActiveCareSituationStore();
  const caregiverId = "cg_sre_reinforce_ingest";
  ingestActiveCareObservation({
    caregiverId,
    rawText: "Mom fell yesterday.",
    kind: classifyCareEventKind("Mom fell yesterday."),
    nowIso: now,
    eventIds: ["ev_reinforce_1"],
  });
  const reinforced = ingestActiveCareObservation({
    caregiverId,
    rawText: "Just reminding you Mom fell yesterday.",
    kind: classifyCareEventKind("Just reminding you Mom fell yesterday."),
    nowIso: now,
    eventIds: ["ev_reinforce_2"],
  });
  assert(
    reinforced.situation.observations.length === 1,
    "G15 ingest: reinforcement does not append duplicate observation",
  );
  assert(
    reinforced.situation.observations[0]!.event_ids.includes("ev_reinforce_2"),
    "G15 ingest: spine event ids merge onto held observation",
  );
  assert(reinforced.relation === "updates_active", "G15 ingest: updates_active without new row");
  console.log("G15 reinforce ingest OK");
}

// G2 improvement outcome
{
  const active = stubAcs({
    id: "acs_eat",
    subject_label: "Mom",
    theme: "emotional_behavior",
    observations: [
      {
        id: "o1",
        raw_text: "Mom refused to eat.",
        human_fact: "Mom refused to eat.",
        kind: "appetite",
        captured_at: now,
        event_ids: ["e1"],
      },
    ],
    open_questions: [],
  });
  const ev = evaluateSituationRelationship({
    active,
    rawText: "She ate better today.",
    kind: classifyCareEventKind("She ate better today."),
    nowIso: now,
  });
  assert(ev.is_improvement_outcome, "G2: improvement outcome");
  assert(ev.decision === "ADD_RELATED_EVENT", "G2: related event not resolve");
  assert(ev.acs_relation !== "opens_new", "G2: stays linked");
  console.log("G2 improvement OK");
}

// G17 identity mismatch
{
  const active = stubAcs({ id: "acs_mom", subject_label: "Mom", theme: "emotional_behavior" });
  const ev = evaluateSituationRelationship({
    active,
    rawText: "Dad had a doctor's appointment today.",
    kind: classifyCareEventKind("Dad had a doctor's appointment today."),
    nowIso: now,
  });
  assert(ev.identity_mismatch, "G17: identity mismatch");
  assert(ev.decision === "UNCERTAIN_NEEDS_REVIEW", "G17: needs review / not attach to Mom");
  assert(ev.acs_relation === "opens_new", "G17: does not update Mom ACS");
  console.log("G17 identity OK");
}

// G17 ingest — identity mismatch must not open new ACS row or inflate observations
{
  resetActiveCareSituationStore();
  const caregiverId = "cg_sre_identity_ingest";
  setCareRecipientDisplayName({
    careKey: resolveCareRealityStoreKey(caregiverId),
    displayName: "Mom",
  });
  ingestActiveCareObservation({
    caregiverId,
    rawText: "Mom fell yesterday.",
    kind: classifyCareEventKind("Mom fell yesterday."),
    nowIso: now,
    eventIds: ["ev_mom_fall"],
  });
  const mismatch = ingestActiveCareObservation({
    caregiverId,
    rawText: "Dad had a doctor's appointment today.",
    kind: classifyCareEventKind("Dad had a doctor's appointment today."),
    nowIso: now,
    eventIds: ["ev_dad_appt"],
  });
  assert(mismatch.identity_mismatch === true, "G17 ingest: identity_mismatch flagged on turn");
  assert(
    mismatch.situation.observations.length === 1,
    "G17 ingest: prior ACS unchanged — no Dad observation appended",
  );
  assert(
    mismatch.what_needs_context.length === 1,
    "G17 ingest: exactly one clarification ask staged",
  );
  assert(
    /dad|someone else/i.test(mismatch.what_needs_context[0] ?? ""),
    "G17 ingest: ask references identity conflict",
  );
  console.log("G17 identity ingest OK");
}

// Answer uncertainty (gap-family asks only — never fall→head product Q&A)
{
  const active = stubAcs({
    id: "acs_fall2",
    subject_label: "Mom",
    theme: "incident",
    open_questions: ["When did this start — or has it been going on?"],
  });
  const ev = evaluateSituationRelationship({
    active,
    rawText: "This started yesterday after lunch.",
    kind: classifyCareEventKind("This started yesterday after lunch."),
    nowIso: now,
  });
  assert(ev.decision === "ANSWER_PREVIOUS_UNCERTAINTY", "answers open uncertainty");
  assert(ev.acs_relation === "answers_uncertainty", "acs answers_uncertainty");
  console.log("Answer uncertainty OK");
}

// Soft update same day
{
  const active = stubAcs({
    id: "acs_soft",
    subject_label: "Mom",
    theme: "emotional_behavior",
    observations: [
      {
        id: "o1",
        raw_text: "Mom seemed frustrated.",
        human_fact: "Mom seemed frustrated.",
        kind: "behavior_change",
        captured_at: now,
        event_ids: ["e1"],
      },
    ],
    open_questions: [],
  });
  const ev = evaluateSituationRelationship({
    active,
    rawText: "She also seemed sad.",
    kind: classifyCareEventKind("She also seemed sad."),
    nowIso: now,
  });
  assert(ev.decision === "UPDATE_EXISTING_SITUATION", "soft same-day updates");
  assert(ev.acs_relation === "updates_active", "updates_active");
  console.log("Soft continuity OK");
}

// G14 — same words, different meaning: relation from Care Reality context, not keyword decline
{
  const busyDay = stubAcs({
    id: "acs_sleep_busy",
    subject_label: "Mom",
    theme: "emotional_behavior",
    observations: [
      {
        id: "o1",
        raw_text: "Busy day with visitors; Mom is tired.",
        human_fact: "Busy day with visitors; Mom is tired.",
        kind: "behavior_change",
        captured_at: now,
        event_ids: ["e1"],
      },
    ],
    open_questions: [],
  });
  const g14 = evaluateSituationRelationship({
    active: busyDay,
    rawText: "Mom is sleeping a lot.",
    kind: classifyCareEventKind("Mom is sleeping a lot."),
    nowIso: now,
  });
  assert(g14.decision === "UPDATE_EXISTING_SITUATION", "G14 updates existing soft context");
  assert(g14.acs_relation === "updates_active", "G14 updates_active");
  assert(!/dementia|progression|decline/i.test(g14.reason), "G14 no decline assumption in reason");
  console.log("G14 context-not-keywords OK");
}

// G16 — contradictory observations stay on same Care Reality (do not erase prior)
{
  const eating = stubAcs({
    id: "acs_eat_conflict",
    subject_label: "Mom",
    theme: "emotional_behavior",
    observations: [
      {
        id: "o1",
        raw_text: "Mom ate normally at lunch.",
        human_fact: "Mom ate normally at lunch.",
        kind: "appetite",
        captured_at: now,
        event_ids: ["e1"],
      },
    ],
    open_questions: [],
  });
  const g16 = evaluateSituationRelationship({
    active: eating,
    rawText: "She barely ate dinner.",
    kind: classifyCareEventKind("She barely ate dinner."),
    nowIso: now,
  });
  assert(
    g16.decision === "UPDATE_EXISTING_SITUATION" || g16.decision === "ADD_RELATED_EVENT",
    "G16 same Care Reality — not silent winner via new erase",
  );
  assert(g16.acs_relation !== "opens_new", "G16 does not open unrelated");
  assert(g16.related_situation_id === "acs_eat_conflict", "G16 stays linked");
  console.log("G16 contradiction continuity OK");
}

// Topic continuity — fall → afraid to walk stays same situation (not keyword piles)
{
  const active = stubAcs({
    id: "acs_fall_mobility",
    subject_label: "Mom",
    theme: "incident",
    open_questions: [],
  });
  const ev = evaluateSituationRelationship({
    active,
    rawText: "She seems afraid to walk now.",
    kind: classifyCareEventKind("She seems afraid to walk now."),
    nowIso: now,
  });
  assert(ev.decision === "UPDATE_EXISTING_SITUATION", "fall→mobility fear updates same");
  assert(ev.acs_relation === "updates_active", "fall→mobility stays on ACS");
  assert(ev.related_situation_id === "acs_fall_mobility", "same situation id");
  console.log("Topic continuity (fall → mobility) OK");
}

// Soft after hard WITHOUT topic continuity still opens new (anti–Clarity bleed)
{
  const active = stubAcs({
    id: "acs_fall_bleed",
    subject_label: "Mom",
    theme: "incident",
    open_questions: [],
  });
  const ev = evaluateSituationRelationship({
    active,
    rawText: "She seemed frustrated about the TV remote.",
    kind: classifyCareEventKind("She seemed frustrated about the TV remote."),
    nowIso: now,
  });
  assert(ev.decision === "NEW_UNRELATED_SITUATION", "unrelated soft after fall opens new");
  assert(ev.acs_relation === "opens_new", "anti–Clarity bleed");
  console.log("Anti–Clarity bleed OK");
}

// New decision → linked related event (not merged)
{
  const active = stubAcs({
    id: "acs_fall_decision",
    subject_label: "Mom",
    theme: "incident",
    open_questions: [],
  });
  const ev = evaluateSituationRelationship({
    active,
    rawText: "Doctor changed her medication after the fall.",
    kind: classifyCareEventKind("Doctor changed her medication after the fall."),
    nowIso: now,
  });
  assert(ev.decision === "ADD_RELATED_EVENT", "decision is linked related event");
  assert(ev.acs_relation === "adds_context", "decision not merged as opens_new");
  assert(ev.related_situation_id === "acs_fall_decision", "linked to fall situation");
  console.log("Decision as related event OK");
}

console.log("\nSituation Relationship Engine verify passed.\n");
