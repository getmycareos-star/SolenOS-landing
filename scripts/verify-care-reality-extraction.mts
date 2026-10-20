/**
 * Care Reality extraction — Observation / Event / Decision / Relationship split.
 * SoT: docs/02-product/solenos-*-extraction.md
 *
 * Illustration wording in fixtures is test-only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import {
  CARE_REALITY_EXTRACTION_PURPOSE,
  EXTRACTION_STACK_ASKS,
  EXTRACTION_STACK_PIPELINE,
  EXTRACTION_STACK_PURPOSE,
  DECISION_EXTRACTION_ASK,
  RELATIONSHIP_EXTRACTION_ASK,
  UNKNOWN_EXTRACTION_ASK,
  UNKNOWN_EXTRACTION_CORE,
  classifyExtractionFragment,
  composeCaregiverConnectionFromRelationships,
  composeCaregiverUnknownAsk,
  containsRelationshipCausationTheater,
  containsRelationshipEnumLeakage,
  containsUnknownStatusLeakage,
  extractCareRealityFromText,
  splitExtractionFragments,
  looksLikeContributorLoadFragment,
  looksLikeDisagreementPerspectiveFragment,
  looksLikeIntentionNotOutcome,
  looksLikeInterpretationWithoutEvidence,
  looksLikeInventedCertaintyFromUncertainty,
  looksLikeOpenUnknownFragment,
  looksLikeOutcomeFragment,
  looksLikeRecommendationNotDecision,
  normalizeEventDescription,
  normalizeOutcomeDescription,
  normalizeUnknownQuestion,
  proposeExtractionRelationships,
  validateUnknownPreservation,
} from "../src/lib/care-reality-extraction";
import { heldFocusLines } from "../src/lib/progressive-understanding/clarity-pillars";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { listDecisionMemory, resetDecisionMemoryStore } from "../src/lib/decision-memory";
import {
  resetCareRecipientIdentityStore,
  setCareRecipientDisplayName,
} from "../src/lib/care-recipient-identity";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";

console.log("=== Care Reality extraction ===\n");
console.log(CARE_REALITY_EXTRACTION_PURPOSE);

{
  // Full stack: Observation → Event → Decision → Relationship → Response Contract
  assert.deepEqual(
    [...EXTRACTION_STACK_PIPELINE],
    [
      "observation",
      "event",
      "decision",
      "relationship",
      "response_contract",
    ],
  );
  assert.ok(/Relationship → Response Contract/i.test(EXTRACTION_STACK_PURPOSE));
  assert.equal(
    EXTRACTION_STACK_ASKS.observation,
    "What was directly witnessed about the person receiving care?",
  );
  assert.equal(
    EXTRACTION_STACK_ASKS.event,
    "What happened, when, who was involved?",
  );
  assert.equal(EXTRACTION_STACK_ASKS.decision, DECISION_EXTRACTION_ASK);
  assert.equal(EXTRACTION_STACK_ASKS.relationship, RELATIONSHIP_EXTRACTION_ASK);
  assert.equal(EXTRACTION_STACK_ASKS.unknown, UNKNOWN_EXTRACTION_ASK);
  assert.ok(/Unknown preserving what is not known/i.test(EXTRACTION_STACK_PURPOSE));
  assert.ok(/Uncertainty is part of the care reality/i.test(UNKNOWN_EXTRACTION_CORE));
  assert.ok(
    looksLikeRecommendationNotDecision(
      "The doctor recommended changing the medication.",
    ),
  );
  assert.equal(
    classifyExtractionFragment("The doctor recommended changing the medication."),
    "skip",
  );
  assert.equal(
    classifyExtractionFragment(
      "They changed one of her medications and I can't remember why.",
    ),
    "decision",
  );
  assert.ok(
    containsRelationshipEnumLeakage("observation_to_event detected"),
  );
  assert.ok(containsRelationshipCausationTheater("The medication caused confusion."));
  assert.ok(
    !containsRelationshipEnumLeakage(
      "What was noticed and what happened around the same time stay connected.",
    ),
  );
  console.log(
    "✓ Extraction stack: Observation → Event → Decision → Relationship → Response Contract",
  );
}

assert.equal(
  looksLikeDisagreementPerspectiveFragment(
    "My brother thinks I'm worrying too much, but he's not here every day.",
  ),
  true,
);
assert.equal(
  looksLikeContributorLoadFragment(
    "I'm trying to keep track of appointments, medications, and everything that's changing.",
  ),
  true,
);
assert.equal(
  classifyExtractionFragment("She has been sleeping a lot more."),
  "observation",
);
assert.equal(
  classifyExtractionFragment(
    "We had a hospital visit after she almost fell in the bathroom a few days ago.",
  ),
  "event",
);
assert.equal(
  classifyExtractionFragment("She has been sleeping a lot more."),
  "observation",
);
assert.equal(
  classifyExtractionFragment("We plan to take her to the hospital next week."),
  "skip",
);
assert.ok(
  !/because|thankfully|unfortunately/i.test(
    normalizeEventDescription(
      "We had a hospital visit because it was terrible news thankfully.",
    ),
  ),
);
console.log("✓ Event layer: occurrence not observation/intention/conclusion");
assert.equal(
  classifyExtractionFragment(
    "They changed one of her medications and I can't remember why.",
  ),
  "decision",
);
assert.equal(
  looksLikeOpenUnknownFragment("Not sure if she is still taking the medication."),
  true,
);
assert.equal(
  classifyExtractionFragment("Not sure if she is still taking the medication."),
  "unknown",
);
assert.equal(
  classifyExtractionFragment("They changed one of her medications last week."),
  "decision",
);
assert.equal(
  classifyExtractionFragment("Her dizziness reduced afterward."),
  "outcome",
);
assert.equal(looksLikeInterpretationWithoutEvidence("Medication worked."), true);
assert.equal(looksLikeOutcomeFragment("Medication worked."), false);
assert.equal(looksLikeIntentionNotOutcome("Doctor wants to monitor mobility."), true);
assert.equal(
  classifyExtractionFragment("Doctor wants to monitor mobility."),
  "skip",
);
assert.ok(
  /perceived improvement/i.test(normalizeOutcomeDescription("She seems better.")),
);
assert.ok(!/condition improved/i.test(normalizeOutcomeDescription("She seems better.")));
console.log("✓ fragment classification separates layers");

{
  // Illustration fixture only — never product if-branches on these nouns.
  // Acceptance: "Not sure if Mom is still taking the medication."
  // Wrong: Medication stopped.  Correct: Unknown — current medication usage requires confirmation.
  const unsureMed = extractCareRealityFromText({
    rawText: "Not sure if Mom is still taking the medication.",
    source: "caregiver",
  });
  assert.ok(unsureMed.unknowns.length >= 1, "uncertainty becomes Unknown");
  assert.ok(
    unsureMed.unknowns.every((u) => u.status === "open"),
    "new unknowns start open",
  );
  assert.ok(
    unsureMed.unknowns.every(
      (u) => u.source && u.importance && u.question && u.status,
    ),
    "unknown requires question, source, importance, status",
  );
  assert.ok(
    unsureMed.unknowns.some((u) =>
      /current medication usage requires confirmation/i.test(u.question),
    ),
    "Correct: Unknown — current medication usage requires confirmation",
  );
  assert.equal(
    normalizeUnknownQuestion("Not sure if Mom is still taking the medication."),
    "Current medication usage requires confirmation.",
  );
  assert.ok(
    looksLikeInventedCertaintyFromUncertainty("Medication stopped."),
    "Wrong path: Medication stopped is invented certainty",
  );
  assert.ok(
    !unsureMed.observations.some((o) =>
      looksLikeInventedCertaintyFromUncertainty(o.description),
    ),
    "must not convert uncertainty into stopped/certain facts",
  );
  assert.ok(
    !unsureMed.observation_focus_lines.some((l) =>
      /medication stopped|no longer taking|stopp(?:ed)?/i.test(l),
    ),
    "must not invent medication stopped as a fact",
  );
  assert.equal(unsureMed.observations.length, 0, "open uncertainty is not an observation fact");
  const ask = composeCaregiverUnknownAsk(unsureMed.unknowns[0]!);
  assert.ok(ask && !/\bstatus\b|answered|declined/i.test(ask));
  assert.ok(!/observation_to_|event_to_/i.test(ask ?? ""));
  assert.ok(!containsUnknownStatusLeakage(ask ?? ""));
  const gate = validateUnknownPreservation({
    responseBlob: "Medication stopped.",
    unknowns: unsureMed.unknowns,
  });
  assert.equal(gate.ok, false);
  assert.ok(gate.failures.includes("uncertainty_converted_to_fact"));
  assert.ok(
    validateUnknownPreservation({
      responseBlob: "Current medication usage requires confirmation.",
      unknowns: unsureMed.unknowns,
    }).ok,
  );
}
console.log("✓ Unknown layer preserves confirmation gaps (never invents facts)");

{
  // Illustration fixture only — Decision vs Outcome vs interpretation vs intention
  const pair = extractCareRealityFromText({
    rawText:
      "They changed one of her medications last week. Her dizziness reduced afterward. She seems better. The doctor wants to monitor mobility. Someone said the medication worked.",
    source: "caregiver",
  });
  assert.ok(pair.decisions.length >= 1, "medication change is a decision");
  assert.ok(pair.outcomes.length >= 1, "reduced afterward is an outcome");
  assert.ok(
    pair.outcomes.some((o) => /reduced|dizziness|perceived improvement/i.test(o.description)),
    "outcome holds observed/perceived result — not success theater",
  );
  assert.ok(
    !pair.outcomes.some((o) => /^medication worked/i.test(o.description)),
    "bare interpretation must not become an outcome",
  );
  assert.ok(
    pair.relationships.some((r) => r.kind === "decision_to_outcome"),
    "decision→outcome relationship linked",
  );
  assert.ok(
    pair.outcomes.every((o) => o.evidence_texts.length >= 1 && o.status),
    "outcomes require evidence + status",
  );
}
console.log("✓ Outcome layer: result after decision with evidence (never success/intention)");

const dump = `
Mom has been more confused over the last couple of weeks. Yesterday she tried to leave the house because she thought she needed to pick me up from school, even though I'm 42. She also asked me the same question over and over, then got upset because she thought nobody was listening to her.

She didn't eat much today, which isn't like her, and I'm not sure if it's because of the new medication the doctor started last week or if she's coming down with something. She's also been sleeping a lot more.

We had a hospital visit after she almost fell in the bathroom a few days ago. They changed one of her medications and told us to follow up with her primary doctor, but I honestly can't remember why they changed it.

My brother thinks I'm worrying too much, but he's not here every day. I'm trying to keep track of appointments, medications, and everything that's changing, and it feels like every time I think I've figured something out, something else happens.

I just don't know what matters most right now or what I should be paying attention to.
`.trim();

const extracted = extractCareRealityFromText({
  rawText: dump,
  source: "caregiver",
});

assert.ok(extracted.observations.length >= 3, "multiple recipient observations");
assert.ok(extracted.events.length >= 1, "hospital visit as event");
assert.ok(
  extracted.events.every((e) => e.participants.length >= 1),
  "events include participants",
);
assert.ok(
  !extracted.events.some((e) => /because|thankfully|unfortunately/i.test(e.description)),
  "events must not invent why/good-bad conclusions",
);
assert.equal(
  extractCareRealityFromText({
    rawText: "We plan to take her to the hospital next week.",
    source: "caregiver",
  }).events.length,
  0,
  "future intentions are not events",
);
assert.ok(extracted.decisions.length >= 1, "med change as decision");
assert.ok(
  extracted.decisions.some((d) => d.reason_unknown),
  "decision preserves Reason unknown",
);
assert.ok(
  extracted.decisions.some((d) => d.who.length >= 1 && d.who[0] !== ""),
  "decision has who",
);
assert.ok(
  extracted.decisions.some((d) => d.evidence_texts.length >= 1),
  "decision linked to evidence at decision time",
);
assert.ok(
  !extracted.decisions.some((d) => /brother thinks|worrying too much/i.test(d.description)),
  "disagreement is never a decision",
);
assert.ok(extracted.unknowns.length >= 1, "Unknown layer present on multi-concern dump");
assert.ok(
  extracted.unknowns.every(
    (u) =>
      u.question &&
      u.source &&
      u.importance &&
      (u.status === "open" ||
        u.status === "answered" ||
        u.status === "declined" ||
        u.status === "no_longer_relevant"),
  ),
  "each unknown has required fields",
);
assert.ok(
  extracted.unknowns.some((u) => u.status === "open" && /confirmation|unclear|why/i.test(u.question)),
  "open confirmation / why gaps preserved",
);
assert.ok(
  !extracted.observations.some((o) => looksLikeInventedCertaintyFromUncertainty(o.description)),
  "observations never invent certainty from uncertainty",
);
assert.ok(
  extracted.non_care_facts.some((n) => n.layer === "disagreement_perspective"),
  "disagreement not an observation",
);
assert.ok(
  extracted.non_care_facts.some((n) => n.layer === "contributor_load"),
  "load not an observation",
);
assert.ok(
  !extracted.observation_focus_lines.some((l) => /brother thinks|worrying too much/i.test(l)),
  "standout candidates exclude disagreement",
);
assert.ok(
  extracted.relationships.some((r) => r.kind === "event_to_decision"),
  "event→decision relationship proposed",
);
assert.ok(
  extracted.relationships.every((r) => r.certainty === "supported" || r.certainty === "possible"),
  "relationships preserve uncertainty band",
);
assert.ok(
  extracted.relationships.every((r) => !/caused|definitely caused/i.test(r.evidence_note)),
  "relationship evidence never invents causation",
);
{
  // Keyword co-mention alone must not invent edges (illustration nouns ≠ product logic).
  const weak = proposeExtractionRelationships({
    observations: [
      {
        id: "o1",
        layer: "observation",
        description: "Sleeping more than usual.",
        approximate_time: null,
        source: "caregiver",
        confidence: "medium",
        raw_fragment: "Sleeping more than usual.",
      },
      {
        id: "o2",
        layer: "observation",
        description: "Ate less at lunch.",
        approximate_time: null,
        source: "caregiver",
        confidence: "medium",
        raw_fragment: "Ate less at lunch.",
      },
    ],
    events: [],
    decisions: [],
  });
  assert.equal(
    weak.length,
    0,
    "adjacent observations without time/context/connective must not auto-link",
  );
}
{
  const plain = composeCaregiverConnectionFromRelationships({
    relationships: extracted.relationships,
    observations: extracted.observations,
    events: extracted.events,
    decisions: extracted.decisions,
    isNewCareReality: true,
  });
  assert.ok(plain && plain.length > 20, "caregiver connection language from relationships");
  assert.ok(
    !containsRelationshipEnumLeakage(plain),
    "never expose relationship enums / certainty to caregivers",
  );
  assert.ok(
    !containsRelationshipCausationTheater(plain),
    "never causal theater in caregiver connection",
  );
  assert.ok(!/\bcaused\b/i.test(plain), "never causal theater in caregiver connection");
}
console.log("✓ extraction layers + relationships on multi-concern dump");

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();

  const careKey = resolveCareRealityStoreKey("cre_extract_first_capture");
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });
  const turn = ingestActiveCareObservation({
    caregiverId: "cre_extract_first_capture",
    rawText: dump,
    kind: "general",
    nowIso: "2026-07-20T15:00:00.000Z",
  });

  const focus = heldFocusLines(turn.situation, 2).join(" ");
  assert.ok(
    !/brother thinks|worrying too much|keep track of appointments/i.test(focus),
    `heldFocus must not center load/disagreement — got: ${focus}`,
  );
  assert.ok(
    !/you shared earlier/i.test(turn.what_changed_in_understanding ?? ""),
    "no fake prior baseline on first capture",
  );

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: dump,
    kind: "general",
  });
  const blob = [
    composed.care_story_update ?? "",
    composed.what_matters_now ?? "",
    ...(composed.what_we_know ?? []),
    composed.situation_summary ?? "",
  ].join(" ");
  assert.ok(
    !/brother thinks|whether .*worrying too much.*keeps appearing/i.test(blob),
    `composer must not center disagreement — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    !/already underway|you shared earlier/i.test(
      `${composed.connection_note ?? ""} ${composed.what_changed ?? ""}`,
    ),
    "no fake continuity on new care reality",
  );
  assert.ok(
    !composed.connection_note,
    "first capture must not use connection_note (prior-story facet)",
  );
  assert.ok(
    !/observation_to_|event_to_decision|decision_to_outcome/i.test(
      `${composed.connection_note ?? ""} ${composed.what_changed ?? ""} ${composed.care_story_update ?? ""}`,
    ),
    "composer must not leak relationship kind enums",
  );
  assert.ok(
    Boolean(composed.what_changed?.trim()),
    "relationship-backed what_changed should surface on multi-concern first capture",
  );
  assert.ok(
    !/observation_to_|event_to_decision|decision_to_outcome|\bstatus:\s*open\b/i.test(
      `${composed.connection_note ?? ""} ${composed.what_changed ?? ""} ${composed.care_story_update ?? ""} ${(composed.still_unclear ?? []).join(" ")}`,
    ),
    "composer must not leak relationship/unknown status enums",
  );
  assert.ok(
    turn.situation.open_questions.length >= 1 || composed.still_unclear.length >= 1,
    "open unknowns persist in care reality and/or surface as still unclear — never dropped",
  );
  assert.ok(
    !composed.what_we_know.some((l) => looksLikeInventedCertaintyFromUncertainty(l)),
    "what_we_know must not invent certainty from uncertainty",
  );
  assert.ok(composed.still_unclear.length <= 3, "≤3 asks");
  assert.ok(
    !composed.still_unclear.some((q) => /brother|worrying too much/i.test(q)),
    "asks must not center disagreement",
  );

  const decisions = listDecisionMemory(careKey);
  assert.ok(decisions.length >= 1, "Decision Memory holds extracted decision");
  assert.ok(
    decisions.some((d) => d.reason === null),
    "Reason unknown preserved in Decision Memory (null why — never invented)",
  );
  console.log("✓ ingest + composer use Observation focus; Decision Reason unknown stored");
}

{
  // Short compound messy note — partition Observation vs Event; never one Action blob.
  const short =
    "mom is not feeling well and i took her to the doctor, she havent been eating well and sleeping well lately";
  const parts = splitExtractionFragments(short);
  assert.ok(parts.length >= 2, `expected clause partition, got ${parts.length}: ${JSON.stringify(parts)}`);
  const layered = extractCareRealityFromText({ rawText: short, source: "caregiver" });
  assert.ok(
    layered.observations.length >= 1,
    "recipient state must become Observation",
  );
  assert.ok(
    layered.events.length >= 1 || layered.actions.length >= 1,
    "doctor visit must be Event or Action — not swallowed into one observation blob",
  );
  assert.ok(
    layered.observations.every((o) => o.description.length < short.length - 10),
    "observation descriptions must not equal the full raw note",
  );
  console.log("✓ short compound note partitions into Observation + journey layers");
}

console.log("\nverify:care-reality-extraction OK");
