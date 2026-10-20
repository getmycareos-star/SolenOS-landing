/**
 * Care Reality output intelligence — structure not echo; baseline→change; epistemic split.
 * SoT: docs/02-product/solenos-final-intelligence-refinement.md
 * Examples in docs are illustrations only — never product templates.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CARE_REALITY_OUTPUT_PURPOSE,
  CARE_REALITY_OUTPUT_TARGET,
  CARE_REALITY_ORIENTATION_ORDER,
  WEAK_ORIENTATION_PHRASES,
  containsWeakOrientation,
  separateEpistemicOutputLayers,
  buildMattersNowFromReality,
  buildMayBecomeSeriousLine,
  buildSituationUnderstandingSummary,
  formatBaselineChangeNote,
  isFutureUsefulOrientation,
} from "../src/lib/care-reality-output";
import { buildCareClarityPillars } from "../src/lib/progressive-understanding/clarity-pillars";
import { formatCompetingSituationLines, prioritizeCompetingAttention } from "../src/lib/mvp-research-validation";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";

const root = process.cwd();

console.log("=== Care Reality Output (Final Intelligence) ===\n");
console.log(CARE_REALITY_OUTPUT_PURPOSE);
console.log(`Target: ${CARE_REALITY_OUTPUT_TARGET}\n`);

assert.ok(CARE_REALITY_ORIENTATION_ORDER.includes("what_understood_about_situation"));
assert.ok(CARE_REALITY_ORIENTATION_ORDER.includes("what_changed"));
assert.ok(WEAK_ORIENTATION_PHRASES.some((p) => p.includes("hard days")));
assert.ok(WEAK_ORIENTATION_PHRASES.some((p) => p.includes("open thread")));
console.log("✓ orientation order + weak-phrase catalog");

{
  const layers = separateEpistemicOutputLayers({
    factLines: [
      "Asked the same question three times this morning.",
      "Unsure whether this is a change or just a hard day.",
      "Held as your experience — not a settled fact: “something feels wrong”",
    ],
    latestRawText: "I think something is wrong.",
    epistemicKind: "caregiver_interpretation",
  });
  assert.ok(layers.observed.some((l) => /question/i.test(l)));
  assert.ok(layers.concerns.length + layers.interpretations.length >= 1);
  assert.ok(!layers.observed.some((l) => /held as your experience/i.test(l)));
  console.log("✓ epistemic split — observed vs interpretation/concern");
}

{
  const withBaseline = buildMattersNowFromReality({
    subjectLabel: null,
    heldFocus: null,
    baselineChange: "Forgot a recent visit — different from usual recall of family visits",
  });
  assert.ok(/usual pattern|worth noticing/i.test(withBaseline));
  assert.ok(!containsWeakOrientation(withBaseline));
  assert.ok(!/stay with what is already held/i.test(withBaseline));

  const withFocus = buildMattersNowFromReality({
    subjectLabel: null,
    heldFocus: "Repeated questions during the morning",
    baselineChange: null,
  });
  assert.ok(/Right now:/i.test(withFocus));
  assert.ok(/continues/i.test(withFocus));
  console.log("✓ what matters now from baseline/focus — not empty hold");
}

{
  const serious = buildMayBecomeSeriousLine({
    subjectLabel: null,
    hasRepeatedPattern: true,
    hasEscalationSignal: false,
  });
  assert.ok(serious);
  assert.ok(/more frequent|daily activities|usual behavior/i.test(serious!));
  assert.ok(!/hard days/i.test(serious!));
  console.log("✓ may-become-serious uses evidence language — not hard days");
}

{
  const note = formatBaselineChangeNote({
    observation: "Forgot a recent visit",
    comparedToBaseline: "Usually remembered recent family visits",
  });
  assert.ok(note && /different from what was usual/i.test(note));
  console.log("✓ baseline change note formatting");
}

{
  const summary = buildSituationUnderstandingSummary({
    heldFacts: ["Repeated questions this week.", "Forgot a recent visit."],
    whatChanged: null,
    isGathering: false,
  });
  assert.ok(summary && !/don'?t know if this is normal/i.test(summary));
  console.log("✓ situation summary from held facts — not uncertainty echo");
}

{
  assert.equal(
    isFutureUsefulOrientation({
      hasPersonOrBaseline: true,
      hasChangeOrObservation: true,
      hasUnknownOrAsk: false,
    }),
    true,
  );
  assert.equal(
    isFutureUsefulOrientation({
      hasPersonOrBaseline: false,
      hasChangeOrObservation: false,
      hasUnknownOrAsk: true,
    }),
    false,
  );
  console.log("✓ future-useful orientation gate");
}

{
  const competing = prioritizeCompetingAttention(
    "Something changed with walking this week. There is also a form due Friday. A visit is scheduled next month.",
  );
  const lines = formatCompetingSituationLines(competing);
  assert.ok(lines.length >= 2);
  assert.ok(!/Open thread/i.test(lines.join(" ")));
  console.log("✓ competing lines use excerpts — not Open thread N");
}

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();

  const text =
    "Repeated the same question several times this morning after forgetting yesterday's visit.";
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_care_reality_output",
    rawText: text,
    kind: classifyCareEventKind(text),
    nowIso: "2026-07-19T18:00:00.000Z",
  });
  const pillars = buildCareClarityPillars({
    situation: turn.situation,
    stage: turn.understanding_stage,
    signals: [],
    latestSignals: [],
    patternLabel: turn.pattern_label,
    kind: classifyCareEventKind(text),
    latestRawText: text,
    baselineChangeNote:
      "Forgot a recent visit — different from what was usual (Usually remembered recent visits)",
  });
  assert.ok(!containsWeakOrientation(pillars.what_matters_now));
  assert.ok(
    /usual pattern|worth noticing|Right now:|Most important next/i.test(
      pillars.what_matters_now,
    ),
  );
  if (pillars.what_may_become_serious) {
    assert.ok(!/hard days/i.test(pillars.what_may_become_serious));
  }

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
    baselineChangeNote:
      "Forgot a recent visit — different from what was usual (Usually remembered recent visits)",
  });
  const blob = [
    composed.what_matters_now,
    composed.what_changed,
    composed.situation_summary,
    ...(composed.what_we_know ?? []),
    composed.what_may_become_serious,
  ]
    .filter(Boolean)
    .join(" ");
  assert.ok(!containsWeakOrientation(blob), "composer output free of weak orientation");
  assert.ok(
    /usual|change|Right now|Forgotten|Forgot|question/i.test(blob),
    "orientation ties to held reality or baseline",
  );
  console.log("✓ composer + pillars with baseline change");
}

// No hardcoded Jennifer / Mom / brother scenario templates in module.
{
  const mod = fs.readFileSync(
    path.join(root, "src/lib/care-reality-output/index.ts"),
    "utf8",
  );
  assert.ok(!/\bJennifer\b/.test(mod), "no Jennifer hardcode");
  assert.ok(!/\bbrother visited\b/i.test(mod), "no brother-visit scenario template");
  const pillarsSrc = fs.readFileSync(
    path.join(root, "src/lib/progressive-understanding/clarity-pillars.ts"),
    "utf8",
  );
  assert.ok(!/If hard days/i.test(pillarsSrc), "hard days phrase removed from pillars");
  assert.ok(
    !/Stay with what is already held in the Living Care Record/i.test(pillarsSrc),
    "empty stay-with hold removed from pillars",
  );
  console.log("✓ no scenario hardcoding / weak pillar templates");
}

{
  const sot = path.join(root, "docs/02-product/solenos-final-intelligence-refinement.md");
  assert.ok(fs.existsSync(sot), "SoT exists");
  const rule = path.join(root, ".cursor/rules/solenos-final-intelligence.mdc");
  assert.ok(fs.existsSync(rule), "Cursor rule exists");
  console.log("✓ SoT + Cursor rule present");
}

console.log("\n=== Care Reality Output: all checks passed ===\n");
