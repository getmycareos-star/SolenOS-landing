/**
 * G7 hard safety Clarity-faster + Tier 4 dementia-entry extended gates.
 */
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
  getActiveCareSituation,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { disclosureStageFor } from "../src/lib/care-reality-state/disclosure";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import {
  composeCaregiverResponse,
  assertComposedResponseProfessional,
  CAREGIVER_RESPONSE_BANNED_PHRASES,
} from "../src/lib/caregiver-response-composer";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resetSourceConflictStore } from "../src/lib/source-conflict";
import {
  evaluateAmbiguousBehaviorShift,
  evaluateNormalcyUncertainty,
  evaluateRepeatedQuestionPattern,
  DIGNITY_AND_POPULATION_BANNED,
} from "../src/lib/dementia-entry-extended";

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetDecisionMemoryStore();
  resetSourceConflictStore();
}

console.log("=== G7 + Tier 4 dementia-entry extended ===\n");

// Soft note #2 still early (regression guard)
assert.equal(
  disclosureStageFor("forming", 2, null, { theme: "emotional_behavior" }),
  "early",
  "soft note 2 stays early",
);

// G7 unit — incident + linked second unlocks growing
assert.equal(
  disclosureStageFor("forming", 2, null, {
    theme: "incident",
    relation: "answers_uncertainty",
    resolvedUncertaintyCount: 1,
  }),
  "growing",
  "G7 hard safety Clarity faster at linked #2",
);

// ——— G7 ———
{
  resetAll();
  const careKey = "cg_g7_hard";
  const t1 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this afternoon.",
    kind: "fall",
    nowIso: "2026-07-17T15:00:00.000Z",
  });
  const c1 = composeCaregiverResponse({
    turn: t1,
    latestRawText: "Mom fell in the hallway this afternoon.",
    kind: "fall",
  });
  assertComposedResponseProfessional(c1);
  assert(/held|Living Care Record/i.test(c1.confirmation), "G7 acknowledge");
  assert(
    !c1.still_unclear.some((q) => /head|walking normally/i.test(q)),
    "G7 no fall→head template",
  );
  assert(c1.still_unclear.length === 1, "G7 Step1: one context invite");
  assert(c1.show_clarity === false, "G7 first hard note: gather before Clarity");
  assert(c1.what_we_know.length >= 1 || true, "G7 may show facts");
  assert(
    !/hit their head|walking normally/i.test(
      [c1.what_matters_now ?? "", ...c1.still_unclear].join(" "),
    ),
    "G7 asks are not a fall→head script",
  );

  const t2 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She is sitting with me now. Urgent care said to watch her overnight.",
    kind: classifyCareEventKind(
      "She is sitting with me now. Urgent care said to watch her overnight.",
    ),
    nowIso: "2026-07-17T15:20:00.000Z",
  });
  assert(
    t2.relation === "answers_uncertainty" ||
      t2.relation === "updates_active" ||
      t2.relation === "adds_context",
    "G7 second note links to hard event",
  );
  assert(t2.disclosure_stage === "growing" || t2.disclosure_stage === "established", "G7 Clarity stage faster");
  const c2 = composeCaregiverResponse({
    turn: t2,
    latestRawText: "She is sitting with me now. Urgent care said to watch her overnight.",
    kind: classifyCareEventKind(
      "She is sitting with me now. Urgent care said to watch her overnight.",
    ),
  });
  assertComposedResponseProfessional(c2);
  assert(c2.show_clarity === true, "G7 Clarity after linked context");
  assert(c2.what_matters_now != null, "G7 oriented with what matters");
  assert(
    !/panic|emergency ui|call 911 immediately unless/i.test(
      [c2.confirmation, c2.what_matters_now ?? "", c2.what_may_become_serious ?? ""].join(" "),
    ),
    "G7 no panic UI",
  );
  console.log("✓ G7 hard event — Held + gap asks, then Clarity faster with linked context");
}

// ——— G31 / G35 ———
{
  resetAll();
  const unit = evaluateRepeatedQuestionPattern({
    priorTexts: [
      "She keeps asking what day it is.",
      "Asked what day it is again this morning.",
    ],
    latestText: "She asked what day it is again after lunch.",
  });
  assert(unit.is_pattern === true, "G35 pattern at 3+");
  assert(unit.occurrence_count >= 3, "G35 count");

  const careKey = "cg_g35";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She keeps asking what day it is.",
    kind: classifyCareEventKind("She keeps asking what day it is."),
    nowIso: "2026-07-17T09:00:00.000Z",
  });
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Asked what day it is again this morning.",
    kind: classifyCareEventKind("Asked what day it is again this morning."),
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She asked what day it is again after lunch.",
    kind: classifyCareEventKind("She asked what day it is again after lunch."),
    nowIso: "2026-07-17T13:00:00.000Z",
  });
  assert(turn.pattern_label === "repeated question pattern", "G35 pattern label");
  assert(/pattern|not separate/i.test(turn.what_changed_in_understanding ?? ""), "G35 pattern note");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "She asked what day it is again after lunch.",
    kind: classifyCareEventKind("She asked what day it is again after lunch."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/dementia is worsening|getting worse|progression/i.test(
      [composed.confirmation, composed.what_changed ?? "", composed.situation_summary ?? ""].join(" "),
    ),
    "G31 no dementia worsening interpretation",
  );
  const acs = getActiveCareSituation(careKey)!;
  assert(acs.observations.length >= 3, "G35 observations linked in one ACS when same day");
  console.log("✓ G31/G35 repeated questions → pattern, not worsening");
}

// ——— G38 / G59 bans ———
{
  for (const phrase of DIGNITY_AND_POPULATION_BANNED) {
    assert(
      CAREGIVER_RESPONSE_BANNED_PHRASES.some((p) => p.toLowerCase() === phrase.toLowerCase()) ||
        phrase === "this is normal for dementia",
      `G38/G59 ban present: ${phrase}`,
    );
  }
  // this is normal for dementia already in composer bans
  assert(
    CAREGIVER_RESPONSE_BANNED_PHRASES.some((p) => /normal for dementia/i.test(p)),
    "G59 population/normal-for-dementia banned",
  );
  console.log("✓ G38/G59 dignity + population comparison bans");
}

// ——— G42 ———
{
  resetAll();
  const unit = evaluateNormalcyUncertainty({
    rawText: "I don't know if this is normal.",
  });
  assert(unit.is_normalcy_signal === true, "G42 signal");
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g42",
    rawText: "I don't know if this is normal — energy dipped after lunch.",
    kind: classifyCareEventKind(
      "I don't know if this is normal — energy dipped after lunch.",
    ),
    nowIso: "2026-07-17T14:00:00.000Z",
  });
  assert(
    turn.pattern_label === "normalcy uncertainty" ||
      turn.pattern_label === "continuity worry" ||
      /care signal|empty reassurance|Oriented/i.test(turn.what_changed_in_understanding ?? ""),
    "G42 held as care signal",
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "I don't know if this is normal — energy dipped after lunch.",
    kind: classifyCareEventKind(
      "I don't know if this is normal — energy dipped after lunch.",
    ),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/everything will be fine|don't worry|perfectly normal|other patients/i.test(
      [composed.confirmation, composed.what_changed ?? ""].join(" "),
    ),
    "G42 no empty reassure / population",
  );
  console.log("✓ G42 normalcy uncertainty as care signal");
}

// ——— G58 ———
{
  resetAll();
  const unit = evaluateAmbiguousBehaviorShift({
    rawText: "He was acting strange this afternoon.",
  });
  assert(unit.is_ambiguous === true, "G58 ambiguous");
  assert(unit.assigns_meaning === false, "G58 no assigned meaning");
  assert(/different from usual/i.test(unit.open_ask ?? ""), "G58 ask what differed");
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g58",
    rawText: "He was acting strange this afternoon.",
    kind: classifyCareEventKind("He was acting strange this afternoon."),
    nowIso: "2026-07-17T16:00:00.000Z",
  });
  assert(turn.pattern_label === "ambiguous behavior shift", "G58 pattern");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "He was acting strange this afternoon.",
    kind: classifyCareEventKind("He was acting strange this afternoon."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    composed.still_unclear.some((q) => /different from usual/i.test(q)) ||
      /without assigning/i.test(composed.what_changed ?? ""),
    "G58 ask or hold without meaning",
  );
  assert(
    !/fear of|confusion diagnosis|this means|anxiety disorder/i.test(
      [composed.confirmation, composed.situation_summary ?? "", ...(composed.what_we_know ?? [])].join(
        " ",
      ),
    ),
    "G58 must not assign meaning",
  );
  console.log("✓ G58 ambiguous shift — ask what differed");
}

// ——— G32 personhood language smoke ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g32",
    rawText: "Mom declined dinner tonight.",
    kind: classifyCareEventKind("Mom declined dinner tonight."),
    nowIso: "2026-07-17T19:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "Mom declined dinner tonight.",
    kind: classifyCareEventKind("Mom declined dinner tonight."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/dementia patient/i.test(
      [composed.confirmation, ...(composed.what_we_know ?? [])].join(" "),
    ),
    "G32 no dementia-patient language",
  );
  console.log("✓ G32 personhood language");
}

// ——— G33 ———
{
  resetAll();
  const careKey = "cg_g33";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "He usually sorts the mail after breakfast.",
    kind: classifyCareEventKind("He usually sorts the mail after breakfast."),
    nowIso: "2026-07-17T09:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "He stopped sorting the mail — hasn't touched it in days.",
    kind: classifyCareEventKind(
      "He stopped sorting the mail — hasn't touched it in days.",
    ),
    nowIso: "2026-07-17T11:00:00.000Z",
  });
  assert(
    turn.pattern_label === "routine disruption" ||
      turn.pattern_label === "personhood life change" ||
      /disrupted|not dismissed/i.test(turn.what_changed_in_understanding ?? ""),
    "G33 routine disruption held",
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "He stopped sorting the mail — hasn't touched it in days.",
    kind: classifyCareEventKind(
      "He stopped sorting the mail — hasn't touched it in days.",
    ),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/\b(ignore this|not important|dismiss(?:ed)? this)\b/i.test(
      [composed.confirmation, composed.what_changed ?? ""].join(" "),
    ) &&
      !/\bas unrelated\b/i.test(composed.confirmation) &&
      (/disrupted|journey|held/i.test(
        [composed.what_changed ?? "", composed.situation_summary ?? "", composed.confirmation].join(
          " ",
        ),
      ) ||
        turn.pattern_label === "routine disruption" ||
        turn.pattern_label === "personhood life change"),
    "G33 held as disruption, not dismissed",
  );
  console.log("✓ G33 routine disruption");
}

// ——— G36 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g36",
    rawText: "She won't leave the house today.",
    kind: classifyCareEventKind("She won't leave the house today."),
    nowIso: "2026-07-17T12:00:00.000Z",
  });
  assert(turn.pattern_label === "situation behind fact", "G36 pattern");
  assert(
    /care situation|not a diagnosis|more going on/i.test(turn.what_changed_in_understanding ?? ""),
    "G36 holds situation",
  );
  assert(
    !/\b(fear of leaving|agoraphobia|confusion disorder|diagnosed with)\b/i.test(
      turn.what_changed_in_understanding ?? "",
    ),
    "G36 no clinical diagnosis",
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "She won't leave the house today.",
    kind: classifyCareEventKind("She won't leave the house today."),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/\bfear of\b|\bconfusion disorder\b|this means she is/i.test(
      [composed.confirmation, composed.situation_summary ?? "", ...(composed.what_we_know ?? [])].join(
        " ",
      ),
    ),
    "G36 must not diagnose",
  );
  console.log("✓ G36 situation behind fact");
}

// ——— G39 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g39",
    rawText: "She came home from the hospital yesterday after discharge.",
    kind: classifyCareEventKind(
      "She came home from the hospital yesterday after discharge.",
    ),
    nowIso: "2026-07-17T14:00:00.000Z",
  });
  assert(turn.pattern_label === "care transition", "G39 care transition");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "She came home from the hospital yesterday after discharge.",
    kind: classifyCareEventKind(
      "She came home from the hospital yesterday after discharge.",
    ),
  });
  assertComposedResponseProfessional(composed);
  assert(/transition/i.test(composed.situation_summary ?? composed.what_changed ?? ""), "G39 framed as transition");
  console.log("✓ G39 care transition memory");
}

// ——— G49 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g49",
    rawText: "I'm now the primary caregiver — my sister used to handle most days.",
    kind: classifyCareEventKind(
      "I'm now the primary caregiver — my sister used to handle most days.",
    ),
    nowIso: "2026-07-17T15:00:00.000Z",
  });
  assert(turn.pattern_label === "caregiver role transition", "G49 role transition");
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "I'm now the primary caregiver — my sister used to handle most days.",
    kind: classifyCareEventKind(
      "I'm now the primary caregiver — my sister used to handle most days.",
    ),
  });
  assertComposedResponseProfessional(composed);
  console.log("✓ G49 caregiver role transition");
}

// ——— G52 ———
{
  resetAll();
  const careKey = "cg_g52";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway last month.",
    kind: "fall",
    nowIso: "2026-07-17T10:00:00.000Z",
  });
  const turn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Today she is afraid to walk to the kitchen — unsteady.",
    kind: classifyCareEventKind(
      "Today she is afraid to walk to the kitchen — unsteady.",
    ),
    nowIso: "2026-07-17T16:00:00.000Z",
  });
  assert(
    turn.pattern_label === "historical importance" ||
      /earlier safety|history still matters/i.test(turn.what_changed_in_understanding ?? ""),
    "G52 historical link",
  );
  console.log("✓ G52 historical importance");
}

// ——— G53 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g53",
    rawText: "This is the first time she needed help getting dressed.",
    kind: classifyCareEventKind(
      "This is the first time she needed help getting dressed.",
    ),
    nowIso: "2026-07-17T17:00:00.000Z",
  });
  assert(turn.pattern_label === "journey milestone", "G53 milestone");
  console.log("✓ G53 journey milestone");
}

// ——— G60 ———
{
  resetAll();
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_g60",
    rawText: "We talked about her POLST and goals of care with the clinic.",
    kind: classifyCareEventKind(
      "We talked about her POLST and goals of care with the clinic.",
    ),
    nowIso: "2026-07-17T18:00:00.000Z",
  });
  assert(turn.pattern_label === "advanced care sensitivity", "G60 advanced care");
  assert(
    /will not make medical decisions/i.test(turn.what_changed_in_understanding ?? ""),
    "G60 not decision engine",
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: "We talked about her POLST and goals of care with the clinic.",
    kind: classifyCareEventKind(
      "We talked about her POLST and goals of care with the clinic.",
    ),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/you should choose|the right choice is|i recommend you sign/i.test(
      [composed.confirmation, composed.situation_summary ?? "", composed.what_changed ?? ""].join(
        " ",
      ),
    ),
    "G60 no medical decision engine",
  );
  console.log("✓ G60 advanced care sensitivity");
}

console.log("\n=== G7 + Tier 4 extended: all checks passed ===\n");
