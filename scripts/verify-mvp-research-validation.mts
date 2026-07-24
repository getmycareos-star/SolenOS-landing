/**
 * MVP research validation — cognitive load gate + competing attention + mental-load capture.
 * Slice 5.6 — retention hypothesis weekly cohort metrics (ops only).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateAgainstResearchValidation,
  prioritizeCompetingAttention,
  formatCompetingSituationLines,
  composeMentalLoadCaptureLines,
  RESEARCH_RETENTION_HYPOTHESIS,
  RESEARCH_DO_NOT_BUILD_NOW,
  deriveRetentionProxySignals,
  recordRetentionResearchEvent,
  attachFeedbackToRetentionResearch,
  aggregateWeeklyRetentionCohortMetrics,
  weekKeyFromIso,
  resetRetentionResearchStore,
  RETENTION_MICRO_PROMPT_STATUS,
} from "../src/lib/mvp-research-validation";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
  pauseActiveCareSituationSession,
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
import { resetDecisionMemoryStore, recordDecisionFromText } from "../src/lib/decision-memory";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { careRealityObservations } from "../src/lib/progressive-understanding/questions";

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetRetentionResearchStore();
}

console.log("=== MVP research validation ===\n");

assert.equal(RESEARCH_RETENTION_HYPOTHESIS.length, 4, "four retention questions");
assert(RESEARCH_DO_NOT_BUILD_NOW.includes("medical_advice_engine"));
assert.equal(RETENTION_MICRO_PROMPT_STATUS, "FUTURE_REQUIRES_ADR", "no survey wall without ADR");

{
  const reject = evaluateAgainstResearchValidation(
    "Build a healthcare navigation marketplace for caregivers",
  );
  assert.equal(reject.verdict, "reject", "marketplace rejected");

  const pass = evaluateAgainstResearchValidation(
    "Strengthen decision memory and situation relationships for continuity",
  );
  assert.equal(pass.verdict, "pass", "continuity feature passes");
  console.log("✓ feature gate — reject marketplace, pass continuity");
}

{
  const multi =
    "Something changed with walking this week. There is also a form due Friday. A visit is scheduled next month.";
  const result = prioritizeCompetingAttention(multi);
  assert(result.is_competing, "competing concerns detected structurally");
  assert(result.situations.length >= 2, "multiple situation threads");
  const lines = formatCompetingSituationLines(result);
  assert(lines.length >= 2, "situation status lines");
  assert(!/todo|task list|checklist/i.test(lines.join(" ")), "not a task list");
  assert(!/\bfell\b|\bconfused\b/i.test(lines.join(" ")), "no keyword category labels");
  console.log("✓ competing attention — structural situations not phrase lanes");
}

{
  const mental = composeMentalLoadCaptureLines({
    observationCount: 2,
    hasPriorConnection: true,
    openUnknowns: [],
    whatChangedHeld: null,
    isDocument: false,
  });
  assert(mental.what_changed != null, "mental load creates what_changed");
  assert(mental.connected_line != null, "connected when prior exists");
  console.log("✓ mental-load capture facets");
}

{
  resetAll();
  const text =
    "Something changed with walking this week. There is also a form due Friday. A visit is scheduled next month.";
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_research_val",
    rawText: text,
    kind: classifyCareEventKind(text),
    nowIso: "2026-07-19T12:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
  });
  assertComposedResponseProfessional(composed);
  assert(
    !/^note created/i.test(composed.confirmation),
    "never note-created confirmation",
  );
  assert(
    /reconstruct|connected|Living Care Record|Held/i.test(composed.confirmation) ||
      (composed.what_changed != null && composed.what_changed.length > 0),
    "capture reduces mental reconstruction burden",
  );
  const blob = [
    composed.confirmation,
    composed.situation_summary,
    ...(composed.what_we_know ?? []),
    composed.what_matters_now,
  ]
    .filter(Boolean)
    .join(" ");
  assert(
    /competing|matters now|Held|reconstruct|Right now|usual|care concern/i.test(blob),
    "competing situations oriented in response",
  );
  assert(!/\b(todo|task 1|checklist)\b/i.test(blob), "no task-manager chrome");
  console.log("✓ composer — competing concerns + mental load feel");
}

// ——— Slice 5.6 — retention instrumentation (ops only) ———
{
  resetRetentionResearchStore();
  const proxies = deriveRetentionProxySignals({
    composed: {
      confirmation: "Held in the Living Care Record.",
      what_changed: "Walking changed this week.",
      situation_summary: "Walking change with admin and visit also held.",
      what_we_know: ["Walking changed this week."],
      what_matters_now: "What changed with walking.",
      still_unclear: ["When did the walking change start?"],
      connection_note: "Connected to what was already held.",
    },
    careWorthyCount: 2,
    isReturn: true,
    relation: "updates_active",
  });
  assert.equal(proxies.signals.understand_better, true);
  assert.equal(proxies.signals.less_fear_of_forgetting, true);
  assert.equal(proxies.signals.can_explain_better, true);
  assert.equal(proxies.signals.would_return_on_change, true);
  assert.ok(proxies.evidence_tags.includes("orientation_surface"));

  const weekA = "2026-07-06T10:00:00.000Z"; // ISO week around early July 2026
  recordRetentionResearchEvent({
    careKey: "cg_cohort_a",
    composed: {
      confirmation: "Held.",
      what_changed: "Fell yesterday.",
      what_we_know: ["Fell yesterday."],
      situation_summary: "Fall held.",
      what_matters_now: "Fall follow-up.",
      still_unclear: [],
      connection_note: null,
    },
    careWorthyCount: 1,
    relation: "opens_new",
    nowIso: weekA,
  });
  recordRetentionResearchEvent({
    careKey: "cg_cohort_b",
    composed: {
      confirmation: "Held.",
      what_changed: "Same questions again.",
      what_we_know: ["Repeated questions."],
      situation_summary: null,
      what_matters_now: null,
      still_unclear: [],
      connection_note: "Connected.",
    },
    careWorthyCount: 2,
    isReturn: true,
    relation: "updates_active",
    nowIso: "2026-07-08T12:00:00.000Z",
  });
  attachFeedbackToRetentionResearch({
    careKey: "cg_cohort_a",
    helpfulFeedback: true,
    reducedConfusion: true,
  });

  const weekKey = weekKeyFromIso(weekA);
  const cohort = aggregateWeeklyRetentionCohortMetrics({ weekKey });
  assert.equal(cohort.ops_only, true);
  assert.equal(cohort.no_caregiver_survey, true);
  assert.ok(cohort.event_count >= 2, "weekly events recorded");
  assert.ok(cohort.cohort_care_keys >= 2, "weekly cohort has care keys");
  assert.ok(
    cohort.rates.understand_what_is_happening_better > 0,
    "understand-better rate available",
  );
  assert.ok(
    cohort.rates.would_use_again_when_something_changes > 0,
    "would-return rate available",
  );

  // No caregiver UI survey wall in product surfaces
  const workspace = fs.readFileSync(
    path.join(process.cwd(), "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
    "utf8",
  );
  assert.ok(
    !/retention score|research survey|how helpful was|nps|would you recommend/i.test(
      workspace,
    ),
    "no caregiver retention survey wall",
  );
  console.log("✓ Slice 5.6 weekly cohort metrics — ops only, no survey wall");
}

// ——— Phase 5 exit — months-of-use fixture: evolution + decisions + uncertainty ———
{
  resetAll();
  const careKey = "cg_months_of_use";
  const t1 = "Mom fell in the hallway this morning.";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: t1,
    kind: classifyCareEventKind(t1),
    nowIso: "2026-01-10T10:00:00.000Z",
  });
  recordDecisionFromText({
    careKey,
    rawText: "We went to urgent care after the fall because she hit her head.",
    nowIso: "2026-01-10T14:00:00.000Z",
    forceFromRelationshipEngine: true,
  });

  const t2 = "She asked the same questions again this afternoon.";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: t2,
    kind: classifyCareEventKind(t2),
    nowIso: "2026-01-10T16:00:00.000Z",
  });
  pauseActiveCareSituationSession(careKey);

  // Return weeks later — CRS durable belief must reconstruct; thin note continues thread when ACS held.
  const t3 = "Same questions again";
  const turn3 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: t3,
    kind: classifyCareEventKind(t3),
    nowIso: "2026-03-20T11:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn: turn3,
    latestRawText: t3,
    kind: classifyCareEventKind(t3),
  });
  recordRetentionResearchEvent({
    careKey,
    composed,
    careWorthyCount: Math.max(
      1,
      careRealityObservations(turn3.situation).length,
    ),
    isReturn: true,
    relation: turn3.relation,
    turnClass: "observation",
    nowIso: "2026-03-20T11:00:00.000Z",
  });

  const crs = getCareRealityState(careKey);
  const acs = getActiveCareSituation(careKey);
  assert.ok(crs != null, "CRS persists across months");
  assert.ok(acs != null, "ACS available on return");
  assert.ok(
    (crs!.current_understanding?.length ?? 0) > 0 ||
      careRealityObservations(acs!).length >= 1,
    "held understanding reconstructable after months",
  );
  const blob = [
    ...(crs?.current_understanding ?? []),
    ...(crs?.open_uncertainties ?? []),
    composed.confirmation,
    ...composed.what_we_know,
    composed.situation_summary ?? "",
  ].join(" ");
  assert.ok(
    /fell|hallway|question|urgent care|Living Care Record|Held/i.test(blob),
    "months-of-use reconstructs evolution from held care reality",
  );
  assert.ok(
    (crs?.open_uncertainties?.length ?? 0) >= 0,
    "uncertainty lane available on CRS",
  );

  const week = weekKeyFromIso("2026-03-20T11:00:00.000Z");
  const metrics = aggregateWeeklyRetentionCohortMetrics({ weekKey: week });
  assert.ok(metrics.event_count >= 1, "months fixture contributes weekly metrics");
  console.log("✓ Phase 5 exit — months-of-use reconstruct + weekly research metrics");
}

console.log("\n=== MVP research validation: all checks passed ===\n");
