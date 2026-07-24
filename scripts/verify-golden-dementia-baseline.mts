/**
 * Golden dementia-entry principles — illustrations are fixtures only.
 * Product must pass with *different* wording than the golden doc examples
 * when the same principle applies (No Prompt Patch / no scenario keyword product).
 */
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
  getActiveCareSituation,
  clearActiveCareSituationMemoryCache,
} from "../src/lib/active-care-situation";
import {
  resetCareRealityStateStore,
  getCareRealityState,
  clearCareRealityStateMemoryCache,
} from "../src/lib/care-reality-state";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import {
  composeCaregiverResponse,
  assertComposedResponseProfessional,
} from "../src/lib/caregiver-response-composer";
import {
  classifyEpistemicClaim,
  detectCareSignalFamily,
  evaluateGradualChange,
  listFamiliarityBaseline,
  listDailyLivingSignals,
  resetCareEpistemicsStores,
  clearFamiliarityBaselineMemoryCache,
  isCareRealityAnchorText,
  isThinCareThreadContinuation,
  isStandaloneCareRealityAnchor,
  observationCareFact,
  isSoftVagueMoodNote,
} from "../src/lib/care-epistemics";
import { projectGracefulLongTermHistory } from "../src/lib/care-history-compression";
import {
  assertRealCaregiverTest,
  evaluateRealCaregiverTest,
  resolveG61ComposeGateMode,
  applyRealCaregiverTestComposeGate,
} from "../src/lib/real-caregiver-test";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import {
  latestObservationIsCareWorthy,
  careRealityObservations,
} from "../src/lib/progressive-understanding/questions";
import { classifyCaregiverTurn } from "../src/lib/response-behavior";
import { evaluateSourceConflict } from "../src/lib/source-conflict";
import { composePerspectiveAttribution } from "../src/lib/perspective-attribution";

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
}

console.log("=== Care epistemics principles (not illustration keywords) ===\n");

// Classification is structural — same principle, different words
assert.equal(
  classifyEpistemicClaim("Dad has been impossible to deal with this week."),
  "caregiver_interpretation",
  "interpretation: judgment without concrete event",
);
assert.equal(
  classifyEpistemicClaim("She refused the afternoon dose and pushed the cup away."),
  "observable_observation",
  "observable: concrete refusal/action",
);
assert.equal(
  classifyEpistemicClaim("He normally walks to the corner store after lunch."),
  "baseline_establishment",
  "baseline: person-told usual",
);
assert.equal(
  detectCareSignalFamily("He forgot the pharmacy pickup."),
  "missed_obligation",
  "structural missed obligation — not appointment-specific",
);
assert.equal(
  detectCareSignalFamily("She left the iron on."),
  "unattended_hazard",
  "structural hazard — not stove-specific",
);
assert.equal(
  detectCareSignalFamily("He needed help getting his shoes on."),
  "needed_assistance",
  "structural assistance — not dressing-specific",
);
console.log("✓ structural classification (varied wording)");

// ——— G37 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g37",
    rawText: "Dad has been impossible to deal with this week.",
    kind: classifyCareEventKind("Dad has been impossible to deal with this week."),
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  assert(
    turn.situation.observations[0]?.epistemic_kind === "caregiver_interpretation",
    "G37 epistemic_kind",
  );
  assert(/you described/i.test(turn.situation.observations[0]?.human_fact ?? ""), "G37 framed");
  assert(/impossible to deal with/i.test(turn.situation.observations[0]?.human_fact ?? ""), "G37 keeps their words");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "Dad has been impossible to deal with this week.",
    kind: classifyCareEventKind("Dad has been impossible to deal with this week."),
  });
  assertComposedResponseProfessional(composed);
  assert(composed.still_unclear.length >= 1, "G37 organizes with asks");
  assert(
    !composed.what_we_know.some((f) => /^dad has been impossible/i.test(f)),
    "G37 no bare judgment as fact",
  );

  ingestActiveCareObservation({
    caregiverId: "cg_g37",
    rawText: "He refused the afternoon dose and pushed the cup away.",
    kind: classifyCareEventKind("He refused the afternoon dose and pushed the cup away."),
    nowIso: "2026-07-17T10:05:00.000Z",
  });
  console.log("✓ G37 interpretation vs observable (non-illustration wording)");
}

// ——— G34 ———
{
  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cg_g34",
    rawText: "He normally walks to the corner store after lunch.",
    kind: classifyCareEventKind("He normally walks to the corner store after lunch."),
    nowIso: "2026-07-01T08:00:00.000Z",
  });
  assert(listFamiliarityBaseline("cg_g34").length >= 1, "G34 stores person-told usual");
  assert(
    listFamiliarityBaseline("cg_g34").some((f) =>
      /corner store|after lunch|usual/i.test(f.statement + " " + f.source_text),
    ),
    "G34 baseline statement retained",
  );
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g34",
    rawText: "Today he stayed in the chair all afternoon.",
    kind: classifyCareEventKind("Today he stayed in the chair all afternoon."),
    nowIso: "2026-07-17T14:00:00.000Z",
  });
  assert(
    turn.what_changed_in_understanding != null &&
      /usual pattern|differ from/i.test(turn.what_changed_in_understanding),
    "G34 change vs their usual",
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "Today he stayed in the chair all afternoon.",
    kind: classifyCareEventKind("Today he stayed in the chair all afternoon."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/dementia progression|normal dementia|typical dementia/i.test(
      [composed.confirmation, composed.what_changed ?? ""].join(" "),
    ),
    "G34 no population dementia",
  );
  console.log("✓ G34 familiarity baseline (non-illustration wording)");
}

// ——— G40 ———
{
  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cg_g40",
    rawText: "He forgot the pharmacy pickup.",
    kind: classifyCareEventKind("He forgot the pharmacy pickup."),
    nowIso: "2026-06-01T10:00:00.000Z",
  });
  ingestActiveCareObservation({
    caregiverId: "cg_g40",
    rawText: "She left the iron on.",
    kind: classifyCareEventKind("She left the iron on."),
    nowIso: "2026-06-08T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g40",
    rawText: "He needed help getting his shoes on.",
    kind: classifyCareEventKind("He needed help getting his shoes on."),
    nowIso: "2026-06-15T10:00:00.000Z",
  });
  assert(listDailyLivingSignals("cg_g40").length >= 3, "G40 signals recorded");
  assert(evaluateGradualChange("cg_g40").emerging === true, "G40 emerges without crisis");
  assert(
    turn.pattern_label === "gradual daily-living changes" ||
      /related care changes|before a crisis/i.test(turn.what_changed_in_understanding ?? ""),
    "G40 surfaces gradual change",
  );
  console.log("✓ G40 gradual signals (structural families, varied topics)");
}

// ——— G43 ———
{
  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cg_g43",
    rawText: "She was disoriented and mixed up after breakfast.",
    kind: classifyCareEventKind("She was disoriented and mixed up after breakfast."),
    nowIso: "2026-07-10T09:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g43",
    rawText: "This afternoon she was clearer and more conversational.",
    kind: classifyCareEventKind("This afternoon she was clearer and more conversational."),
    nowIso: "2026-07-11T15:00:00.000Z",
  });
  assert(turn.pattern_label === "day-to-day fluctuation", "G43 fluctuation");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "This afternoon she was clearer and more conversational.",
    kind: classifyCareEventKind("This afternoon she was clearer and more conversational."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/dementia improved|dementia is improving|condition improved/i.test(
      [composed.confirmation, composed.what_changed ?? ""].join(" "),
    ),
    "G43 no disease-improved claim",
  );
  console.log("✓ G43 fluctuation");
}

// ——— G41 ———
{
  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cg_g41",
    rawText: "She loves playing cards with the neighbors.",
    kind: classifyCareEventKind("She loves playing cards with the neighbors."),
    nowIso: "2026-05-01T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g41",
    rawText: "She stopped playing cards this month.",
    kind: classifyCareEventKind("She stopped playing cards this month."),
    nowIso: "2026-07-01T10:00:00.000Z",
  });
  assert(turn.pattern_label === "personhood life change", "G41 personhood via overlap");
  console.log("✓ G41 past self (cards — not gardening keyword)");
}

// ——— G48 ———
{
  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cg_g48",
    rawText: "He hates crowded waiting rooms.",
    kind: classifyCareEventKind("He hates crowded waiting rooms."),
    nowIso: "2026-04-01T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g48",
    rawText: "We may need a long wait in a crowded waiting room tomorrow.",
    kind: classifyCareEventKind("We may need a long wait in a crowded waiting room tomorrow."),
    nowIso: "2026-07-01T10:00:00.000Z",
  });
  assert(
    turn.what_changed_in_understanding != null && /Remembered/i.test(turn.what_changed_in_understanding),
    "G48 preference recalled by content overlap",
  );
  console.log("✓ G48 preference recall (waiting rooms — not hospital keyword)");
}

// ——— G45 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g45",
    rawText: "Something feels off with her this week.",
    kind: classifyCareEventKind("Something feels off with her this week."),
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  assert(turn.pattern_label === "change with unknown cause", "G45 unknown cause");
  assert(/cause is not known/i.test(turn.what_changed_in_understanding ?? ""), "G45 preserves unknown");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "Something feels off with her this week.",
    kind: classifyCareEventKind("Something feels off with her this week."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/depression|worsening dementia|probably the medication/i.test(
      [composed.confirmation, composed.what_changed ?? "", composed.what_is_happening ?? ""].join(" "),
    ),
    "G45 no invented cause",
  );
  console.log("✓ G45 unknown cause (not quieter-than-usual keyword)");
}

// ——— G47 ———
{
  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cg_g47",
    rawText: "She left the iron on again.",
    kind: classifyCareEventKind("She left the iron on again."),
    nowIso: "2026-06-01T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g47",
    rawText: "She wants to iron alone this evening.",
    kind: classifyCareEventKind("She wants to iron alone this evening."),
    nowIso: "2026-06-08T18:00:00.000Z",
  });
  assert(turn.pattern_label === "recurring safety area", "G47 safety link by overlap");
  assert(/safety (?:area|concern)/i.test(turn.what_changed_in_understanding ?? ""), "G47 note");
  console.log("✓ G47 safety continuity (iron — not stove keyword)");
}

// ——— G46 ———
{
  resetAll();
  const contained = ingestActiveCareObservation({
    caregiverId: "cg_g46a",
    rawText: "He misplaced his reading glasses again.",
    kind: classifyCareEventKind("He misplaced his reading glasses again."),
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  assert(contained.pattern_label === "contained change", "G46 contained change");
  assert(/not treated as a crisis/i.test(contained.what_changed_in_understanding ?? ""), "G46 no alarm");

  resetAll();
  const elevated = ingestActiveCareObservation({
    caregiverId: "cg_g46b",
    rawText: "She left the house and could not find her way back.",
    kind: classifyCareEventKind("She left the house and could not find her way back."),
    nowIso: "2026-07-17T11:00:00.000Z",
  });
  assert(elevated.pattern_label === "elevated safety concern", "G46 elevated");
  assert(/safety orientation|matters for safety/i.test(elevated.what_changed_in_understanding ?? ""), "G46 elevated note");
  const composed = composeCaregiverResponse({
    turn: elevated,
    latestRawText: "She left the house and could not find her way back.",
    kind: classifyCareEventKind("She left the house and could not find her way back."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/crisis mode|emergency now|call 911/i.test(
      [composed.confirmation, composed.what_changed ?? "", composed.what_is_happening ?? ""].join(" "),
    ),
    "G46 elevated without panic theater",
  );
  console.log("✓ G46 change vs crisis separation");
}

// ——— G50 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g50",
    rawText: "I forgot to give her the evening dose.",
    kind: classifyCareEventKind("I forgot to give her the evening dose."),
    nowIso: "2026-07-17T20:00:00.000Z",
  });
  assert(turn.pattern_label === "missed care timing", "G50 missed timing");
  assert(/not to (?:assign )?blame|not to judge/i.test(turn.what_changed_in_understanding ?? ""), "G50 no blame");
  assert(/care timing was missed/i.test(turn.situation.observations[0]?.human_fact ?? ""), "G50 framed");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "I forgot to give her the evening dose.",
    kind: classifyCareEventKind("I forgot to give her the evening dose."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/adherence failed|non-adherence|noncompliance|you failed|caregiver failed/i.test(
      [composed.confirmation, composed.what_changed ?? "", ...(composed.what_we_know ?? [])].join(" "),
    ),
    "G50 never judges caregiver",
  );
  console.log("✓ G50 no caregiver blame");
}

// ——— G51 ———
{
  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cg_g51",
    rawText: "She needs more help at home now.",
    kind: classifyCareEventKind("She needs more help at home now."),
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g51",
    rawText: "Actually I think she's doing fine.",
    kind: classifyCareEventKind("Actually I think she's doing fine."),
    nowIso: "2026-07-17T12:00:00.000Z",
  });
  assert(turn.pattern_label === "disagreeing care views", "G51 disagreement");
  assert(/not choosing sides/i.test(turn.what_changed_in_understanding ?? ""), "G51 no sides");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "Actually I think she's doing fine.",
    kind: classifyCareEventKind("Actually I think she's doing fine."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/i agree|you're right|sibling is wrong|take (?:her|his) side/i.test(
      [composed.confirmation, composed.what_changed ?? ""].join(" "),
    ),
    "G51 never picks a side",
  );
  console.log("✓ G51 disagreeing views without escalation");
}

// ——— G54 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g54",
    rawText: "She isn't herself today.",
    kind: classifyCareEventKind("She isn't herself today."),
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  assert(turn.situation.observations.length === 1, "G54 accepts everyday language");
  assert(
    turn.pattern_label === "change with unknown cause" ||
      turn.pattern_label === "natural language observation" ||
      /held|cause is not known|everyday language/i.test(turn.what_changed_in_understanding ?? turn.confirmation_body),
    "G54 valuable without medical vocabulary",
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "She isn't herself today.",
    kind: classifyCareEventKind("She isn't herself today."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/please (?:use|provide) (?:clinical|medical)|diagnosis code|icd/i.test(
      [...composed.still_unclear, composed.confirmation].join(" "),
    ),
    "G54 must not require medical vocabulary",
  );
  console.log("✓ G54 natural language variability");
}

// ——— G55 ———
{
  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cg_g55",
    rawText: "He usually recognizes everyone in the house.",
    kind: classifyCareEventKind("He usually recognizes everyone in the house."),
    nowIso: "2026-07-01T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g55",
    rawText: "Today he forgot who I was.",
    kind: classifyCareEventKind("Today he forgot who I was."),
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  assert(turn.pattern_label === "continuity worry", "G55 continuity worry");
  assert(/not a diagnosis|Oriented from what is already held/i.test(turn.what_changed_in_understanding ?? ""), "G55 orients");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "Today he forgot who I was.",
    kind: classifyCareEventKind("Today he forgot who I was."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    composed.what_changed != null || (composed.what_we_know?.length ?? 0) > 0,
    "G55 surfaces known/changed context",
  );
  assert(
    !/everything will be fine|don't worry|perfectly normal|dementia is worsening|this means/i.test(
      [composed.confirmation, composed.what_changed ?? "", composed.what_is_happening ?? ""].join(" "),
    ),
    "G55 no empty reassure or diagnosis",
  );
  console.log("✓ G55 question behind the question");
}

// ——— G56 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g56",
    rawText: "Quick note from the car — energy dipped after lunch.",
    kind: classifyCareEventKind("Quick note from the car — energy dipped after lunch."),
    nowIso: "2026-07-17T13:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "Quick note from the car — energy dipped after lunch.",
    kind: classifyCareEventKind("Quick note from the car — energy dipped after lunch."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/daily check-?in|fill out (?:this )?form|complete your dashboard|category homework|please categorize/i.test(
      [...composed.still_unclear, composed.confirmation].join(" "),
    ),
    "G56 no forced tracking burden",
  );
  console.log("✓ G56 no forced tracking burden");
}

// ——— G44 ———
{
  resetAll();
  const careKey = "cg_g44_shared";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She loves evening walks around the block.",
    kind: classifyCareEventKind("She loves evening walks around the block."),
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  // Related follow-up same day so ACS stays one open situation
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She skipped the evening walk today — energy was low after lunch.",
    kind: classifyCareEventKind(
      "She skipped the evening walk today — energy was low after lunch.",
    ),
    nowIso: "2026-07-17T14:00:00.000Z",
  });
  assert(listFamiliarityBaseline(careKey).length >= 1, "G44 personhood stored");
  const before = getActiveCareSituation(careKey);
  assert(
    before != null && before.observations.length >= 2,
    "G44 ACS before bounce holds open situation + history",
  );

  // Simulate another contributor / process: memory caches cleared, durable Care Reality remains
  clearActiveCareSituationMemoryCache();
  clearCareRealityStateMemoryCache();
  clearFamiliarityBaselineMemoryCache();
  const restored = getActiveCareSituation(careKey);
  assert(
    restored != null && restored.observations.length >= 2,
    "G44 ACS restored by care key",
  );
  assert(listFamiliarityBaseline(careKey).length >= 1, "G44 personhood restored by care key");
  const crs = getCareRealityState(careKey);
  assert(crs != null && crs.observation_count >= 1, "G44 CRS restored by care key");
  console.log("✓ G44 memory transfer via durable care key");
}

// ——— G57 ———
{
  // Multi-year synthetic history — different wording than golden illustrations
  const longHistory = [
    {
      raw_text: "He usually sorts the mail after breakfast.",
      captured_at: "2024-01-10T10:00:00.000Z",
    },
    {
      raw_text: "Energy was fine most of the afternoon.",
      captured_at: "2024-03-02T15:00:00.000Z",
    },
    {
      raw_text: "Skipped the morning stretch once.",
      captured_at: "2024-06-12T09:00:00.000Z",
    },
    {
      raw_text: "Left the iron on after pressing shirts.",
      captured_at: "2024-09-01T11:00:00.000Z",
    },
    {
      raw_text: "Quiet evening, nothing notable.",
      captured_at: "2025-01-20T19:00:00.000Z",
    },
    {
      raw_text: "Ate lunch without prompting.",
      captured_at: "2025-04-08T13:00:00.000Z",
    },
    {
      raw_text: "Needed help finding the bathroom down the hall.",
      captured_at: "2025-08-15T16:00:00.000Z",
    },
    {
      raw_text: "Watched the game for an hour.",
      captured_at: "2025-11-02T18:00:00.000Z",
    },
    {
      raw_text: "Short nap after lunch.",
      captured_at: "2026-02-14T14:00:00.000Z",
    },
    {
      raw_text: "Asked what day it was twice this morning.",
      captured_at: "2026-07-10T09:00:00.000Z",
    },
    {
      raw_text: "Energy dipped after lunch today.",
      captured_at: "2026-07-17T14:00:00.000Z",
    },
    {
      raw_text: "Seemed more settled by evening.",
      captured_at: "2026-07-17T20:00:00.000Z",
    },
  ];
  const projected = projectGracefulLongTermHistory({
    observations: longHistory,
    familiarityStatements: ["He usually sorts the mail after breakfast."],
    openUncertainties: ["What else have you noticed alongside this, if anything?"],
    nowIso: "2026-07-17T22:00:00.000Z",
  });
  assert(projected.compression_applied === true, "G57 compression when history is long");
  assert(
    projected.caregiver_lines.length <= 5,
    "G57 caregiver lines capped — no multi-year dump",
  );
  assert(projected.dumps_full_history === false, "G57 must not dump full history");
  assert(projected.older_compressed_count >= 1, "G57 reduces older noise");
  assert(
    projected.preserved_important.some((l) => /iron|bathroom|mail|sorts/i.test(l)),
    "G57 preserves important evidence (safety / preference)",
  );
  console.log("✓ G57 graceful long-term compression");
}

// ——— G61 ———
{
  resetAll();
  const careKey = "cg_g61_2am";
  // Difficult evening — non-illustration wording; clock is 2AM metaphor for exhaustion
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "He refused dinner and pushed the plate away.",
    kind: classifyCareEventKind("He refused dinner and pushed the plate away."),
    nowIso: "2026-07-17T19:00:00.000Z",
  });
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Later he asked where we were going even though we were home.",
    kind: classifyCareEventKind(
      "Later he asked where we were going even though we were home.",
    ),
    nowIso: "2026-07-17T22:30:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "I am exhausted and not sure what matters most right now.",
    kind: classifyCareEventKind(
      "I am exhausted and not sure what matters most right now.",
    ),
    nowIso: "2026-07-18T02:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "I am exhausted and not sure what matters most right now.",
    kind: classifyCareEventKind(
      "I am exhausted and not sure what matters most right now.",
    ),
  });
  assertRealCaregiverTest(composed, "G61 real caregiver 2AM test");
  console.log("✓ G61 real caregiver test");
}

// ——— Slice 5.5 — G61 compose-path gate modes + reconstruct false-positive ———
{
  assert.equal(
    isSoftVagueMoodNote("She's frustrated."),
    true,
    "frustrated stem matches soft mood",
  );
  assert.equal(
    isCareRealityAnchorText("She's frustrated."),
    true,
    "frustrated soft note is care anchor",
  );

  // "do not have to reconstruct" must not fail G61
  const softTurn = ingestActiveCareObservation({
    caregiverId: "cg_g61_reconstruct",
    rawText: "She hasnt been feeling well.",
    kind: classifyCareEventKind("She hasnt been feeling well."),
    nowIso: "2026-07-18T10:00:00.000Z",
  });
  const softComposed = composeCaregiverResponse({
    turn: softTurn,
    latestRawText: "She hasnt been feeling well.",
    kind: classifyCareEventKind("She hasnt been feeling well."),
  });
  const softEval = evaluateRealCaregiverTest(softComposed);
  assert.equal(
    softEval.pass,
    true,
    `G61 must not false-positive on reconstruct phrasing: ${softEval.fails.join("; ")}`,
  );

  assert.equal(
    resolveG61ComposeGateMode({ NODE_ENV: "development" }),
    "throw",
    "dev default throws",
  );
  assert.equal(
    resolveG61ComposeGateMode({ NODE_ENV: "production" }),
    "off",
    "prod default off",
  );
  assert.equal(
    resolveG61ComposeGateMode({ NODE_ENV: "production", SOLENOS_G61_COMPOSE_GATE: "1" }),
    "log",
    "prod flag logs only",
  );
  assert.equal(
    resolveG61ComposeGateMode({ SOLENOS_VERIFY: "1" }),
    "off",
    "verify env off by default",
  );

  const logs: string[] = [];
  applyRealCaregiverTestComposeGate({
    composed: softComposed,
    turnClass: "observation",
    env: { NODE_ENV: "production", SOLENOS_G61_COMPOSE_GATE: "1" },
    log: (m) => logs.push(m),
  });
  // Passing compose should not log
  assert.equal(logs.length, 0, "passing G61 produces no prod log");

  // Failing compose in prod logs and does not throw
  const bad = {
    ...softComposed,
    confirmation: "",
    what_changed: null,
    situation_summary: null,
    what_we_know: [] as string[],
  };
  assert.doesNotThrow(() => {
    applyRealCaregiverTestComposeGate({
      composed: bad,
      turnClass: "observation",
      env: { NODE_ENV: "production", SOLENOS_G61_COMPOSE_GATE: "1" },
      log: (m) => logs.push(m),
    });
  }, "prod gate never throws");
  assert.ok(logs.length >= 1, "prod gate logs failure");

  assert.throws(
    () =>
      applyRealCaregiverTestComposeGate({
        composed: bad,
        turnClass: "observation",
        env: { NODE_ENV: "development", SOLENOS_G61_COMPOSE_GATE: "1" },
      }),
    /G61 Real Caregiver Test failed/,
    "dev gate throws on fail",
  );
  console.log("✓ Slice 5.5 G61 compose-path gate — throw in dev, log in prod");
}

// ——— Slice 5.4 — thin thread continuity + meta + multi-contributor keep both ———
{
  // Done when: “Same questions again” after “she repeated…” counts as care-worthy
  assert.equal(
    isStandaloneCareRealityAnchor("Same questions again"),
    false,
    "thin follow-up alone is not a standalone anchor",
  );
  assert.equal(
    isThinCareThreadContinuation("Same questions again", [
      "She repeated the same questions all morning.",
    ]),
    true,
    "thin follow-up continues held repeated-questions thread",
  );
  assert.equal(
    isCareRealityAnchorText("Same questions again", {
      priorFacts: ["She repeated the same questions all morning."],
    }),
    true,
    "thread-context makes thin note a care anchor",
  );

  // Natural-language unease aligns with care anchor (emotional/NL path)
  assert.equal(
    isStandaloneCareRealityAnchor("Something feels off with her this week."),
    true,
    "NL unease is care-reality anchor",
  );

  // Meta must not inherit thread continuity
  assert.equal(
    isCareRealityAnchorText("thanks for helping me organize this", {
      priorFacts: ["She repeated the same questions all morning."],
    }),
    false,
    "thin thanks does not become care-worthy via thread",
  );
  assert.equal(
    isCareRealityAnchorText(
      "hi solenos, this is my first time here, i just got recommended that youd help me",
      { priorFacts: ["Mom fell in the hallway this morning."] },
    ),
    false,
    "product meta never inherits care-worthy via thread",
  );

  resetAll();
  const thinKey = "cg_thin_thread_54";
  ingestActiveCareObservation({
    caregiverId: thinKey,
    rawText: "She repeated the same questions all morning.",
    kind: classifyCareEventKind("She repeated the same questions all morning."),
    nowIso: "2026-07-20T10:00:00.000Z",
  });
  const thinTurn = ingestActiveCareObservation({
    caregiverId: thinKey,
    rawText: "Same questions again",
    kind: classifyCareEventKind("Same questions again"),
    nowIso: "2026-07-20T14:00:00.000Z",
  });
  assert.equal(
    latestObservationIsCareWorthy(thinTurn.situation),
    true,
    "Same questions again after she repeated… is care-worthy via ACS thread",
  );
  assert.ok(
    careRealityObservations(thinTurn.situation).length >= 2,
    "both prior + thin continuation count as care observations",
  );
  const thinClass = classifyCaregiverTurn({
    latestRawText: "Same questions again",
    kind: classifyCareEventKind("Same questions again"),
    turn: thinTurn,
  });
  assert.equal(thinClass, "observation", "thin care thread is observation, not empty/emotional");
  const thinFact = observationCareFact({
    raw_text: "Same questions again",
    priorFacts: ["She repeated the same questions all morning."],
  });
  assert.ok(thinFact, "observationCareFact returns thin continuation");
  console.log("✓ Slice 5.4 thin thread — Same questions again is care-worthy");

  // Multi-contributor polarity conflict — both retained
  const multi = evaluateSourceConflict({
    priorObservations: [
      {
        raw_text: "She barely ate dinner.",
        kind: "general",
        captured_at: "2026-07-20T18:00:00.000Z",
        contributor_id: "cg_daughter",
      },
    ],
    incomingText: "She ate well tonight.",
    incomingKind: "general",
    incomingCapturedAt: "2026-07-20T19:00:00.000Z",
    incomingContributorId: "cg_son",
  });
  assert.equal(multi.has_conflict, true, "multi-contributor opposing polarity is conflict");
  assert.equal(multi.both_retained, true, "conflict keeps both");
  assert.ok(
    multi.pattern_label === "disagreeing care views" || multi.pattern_label === "source conflict",
    "multi-contributor conflict labeled",
  );

  resetAll();
  ingestActiveCareObservation({
    caregiverId: "cr_shared_54",
    contributorId: "cg_daughter",
    rawText: "She barely ate dinner.",
    kind: classifyCareEventKind("She barely ate dinner."),
    nowIso: "2026-07-20T18:00:00.000Z",
  });
  const multiTurn = ingestActiveCareObservation({
    caregiverId: "cr_shared_54",
    contributorId: "cg_son",
    rawText: "She ate well tonight.",
    kind: classifyCareEventKind("She ate well tonight."),
    nowIso: "2026-07-20T19:00:00.000Z",
  });
  assert.ok(
    multiTurn.situation.observations.length >= 2,
    "multi-contributor observations both stored",
  );
  const perspectives = composePerspectiveAttribution({
    situation: multiTurn.situation,
    patternLabel: multiTurn.pattern_label,
  });
  assert.equal(perspectives.both_retained, true, "perspective keeps both");
  assert.equal(perspectives.silent_winner, false, "no silent winner");
  console.log("✓ Slice 5.4 multi-contributor conflict — both retained");
}

console.log("\n=== Care epistemics principles: all checks passed ===\n");
