/**
 * verify-care-reality-state.mts
 * Care Reality State + Response Evolution + Progressive Disclosure (product identity).
 */

import {
  CARE_REALITY_STATE_CHAIN,
  CARE_REALITY_STATE_IDENTITY,
  CARE_REALITY_STATE_PURPOSE,
  CARE_REALITY_INTERNAL_QUESTION,
  CARE_REALITY_FORBIDDEN_INTERNAL_QUESTION,
  DISCLOSURE_SECTIONS_BY_STAGE,
  getCareRealityState,
  resetCareRealityStateStore,
  disclosureStageFor,
  evaluateResponseEvolution,
  buildDisclosurePlan,
} from "../src/lib/care-reality-state";
import {
  PRODUCT_IDENTITY_CONTRACTS,
  PRODUCT_IDENTITY_NON_NEGOTIABLE,
  STABLE_CARE_IDENTITY_CONTRACT,
  BASELINE_VS_CHANGE_CONTRACT,
  DECISION_MEMORY_CONTRACT,
  EVIDENCE_HIERARCHY_CONTRACT,
  UNDERSTANDING_LIFECYCLE_CONTRACT,
  COGNITIVE_LOAD_BUDGET_CONTRACT,
} from "../src/lib/product-identity-architecture";
import {
  ingestActiveCareObservation,
  clearActiveCareSituation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { classifyCareEventKind, buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import {
  CARE_REALITY_STATE,
  PROGRESSIVE_UNDERSTANDING_ENGINE,
} from "../src/lib/solenos-layers/architecture-map";
import { PROGRESSIVE_UNDERSTANDING_CHAIN } from "../src/lib/progressive-understanding";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import fs from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Care Reality State + Product Identity ===\n");

assert(CARE_REALITY_STATE_IDENTITY.includes("Care Reality State"), "identity");
assert(CARE_REALITY_STATE_PURPOSE.includes("never from the latest message alone"), "purpose");
assert(CARE_REALITY_STATE_CHAIN.includes("care_reality_state"), "chain has CRS");
assert(CARE_REALITY_STATE_CHAIN.includes("progressive_understanding"), "chain has PUE");
assert(
  PROGRESSIVE_UNDERSTANDING_CHAIN.includes("care_reality_state"),
  "PUE chain includes care_reality_state",
);
assert(CARE_REALITY_INTERNAL_QUESTION.includes("understanding"), "internal question");
assert(
  CARE_REALITY_FORBIDDEN_INTERNAL_QUESTION.includes("just type"),
  "forbidden internal question",
);
assert(CARE_REALITY_STATE.modulePath.includes("care-reality-state"), "arch map CRS");
assert(
  PROGRESSIVE_UNDERSTANDING_ENGINE.position.includes("care_reality_state"),
  "PUE position before CRS",
);
assert(
  fs.existsSync(
    path.join(process.cwd(), "docs/15-architecture-decisions/ADR-021-care-reality-state-product-identity.md"),
  ),
  "ADR-021",
);
assert(PRODUCT_IDENTITY_NON_NEGOTIABLE.includes("Care Reality State"), "non-negotiable");
assert(PRODUCT_IDENTITY_CONTRACTS.length === 6, "six identity contracts");
assert(STABLE_CARE_IDENTITY_CONTRACT.status === "CONTRACT", "P1-9 CONTRACT");
assert(BASELINE_VS_CHANGE_CONTRACT.status === "CONTRACT", "P1-10 CONTRACT");
assert(DECISION_MEMORY_CONTRACT.status === "CONTRACT", "P1-11 CONTRACT");
assert(EVIDENCE_HIERARCHY_CONTRACT.status === "CONTRACT", "P1-12 CONTRACT");
assert(UNDERSTANDING_LIFECYCLE_CONTRACT.status === "CONTRACT", "P1-13 CONTRACT");
assert(COGNITIVE_LOAD_BUDGET_CONTRACT.status === "CONTRACT", "P2-4 CONTRACT");
assert(DISCLOSURE_SECTIONS_BY_STAGE.early.includes("confirmation"), "early sections");
assert(disclosureStageFor("gathering", 1, null) === "early", "disclosure early");
assert(disclosureStageFor("forming", 2, null) === "early", "disclosure soft note 2 stays early");
assert(disclosureStageFor("forming", 3, null) === "growing", "disclosure growing at 3");
assert(disclosureStageFor("synthesizing", 3, "distress") === "established", "disclosure established");
console.log("✓ contracts + arch + ADR + disclosure stages");

resetActiveCareSituationStore();
resetCareRealityStateStore();

const t1 = ingestActiveCareObservation({
  caregiverId: "cg_crs",
  rawText: "Mom seems frustrated.",
  kind: classifyCareEventKind("Mom seems frustrated."),
  nowIso: "2026-07-16T14:00:00.000Z",
});
assert(t1.disclosure_stage === "early", "obs1 early disclosure");
assert(t1.disclosure_plan.show_what_changed === false, "obs1 no what-changed section");
assert(t1.disclosure_plan.max_questions <= 1, "obs1 max 1 question");
assert(t1.what_needs_context.length <= 1, "obs1 shows at most 1 question");
assert(t1.care_reality_state_id != null, "obs1 CRS id");
assert(t1.response_evolution.updates_active_situation === false, "obs1 opens new");
const crs1 = getCareRealityState("cg_crs");
assert(crs1 != null, "CRS stored after obs1");
assert(crs1!.revision === 1, "revision 1");
assert(crs1!.understanding_revisions.length === 1, "lifecycle revision 1");
console.log("✓ obs1 → early Care Reality State");

const t2 = ingestActiveCareObservation({
  caregiverId: "cg_crs",
  rawText: "She seems sad.",
  kind: classifyCareEventKind("She seems sad."),
  nowIso: "2026-07-16T14:05:00.000Z",
});
assert(t2.disclosure_stage === "early", "obs2 soft update stays early (no auto Clarity)");
assert(t2.disclosure_plan.show_what_changed === false, "obs2 early hides what-changed section");
assert(t2.what_changed_in_understanding != null || t2.current_understanding.length >= 1, "obs2 still evolves understanding");
assert(t2.what_needs_context.length <= 1, "obs2 at most 1 question");
assert(
  !t1.what_needs_context.some((q) =>
    t2.what_needs_context.some((q2) => q2.toLowerCase() === q.toLowerCase()),
  ),
  "obs2 does not repeat obs1 questions verbatim",
);
assert(t2.response_evolution.updates_active_situation === true, "obs2 updates ACS");
assert(t2.care_reality_state_id === crs1!.id, "same CRS id across turns");
const crs2 = getCareRealityState("cg_crs");
assert(crs2!.revision === 2, "revision 2");
assert(crs2!.understanding_revisions.length === 2, "lifecycle revisions grow");
console.log("✓ obs2 → growing understanding (response evolution)");

const t3 = ingestActiveCareObservation({
  caregiverId: "cg_crs",
  rawText: "She keeps saying she wants to go home.",
  kind: classifyCareEventKind("She keeps saying she wants to go home."),
  nowIso: "2026-07-16T14:10:00.000Z",
});
assert(t3.disclosure_stage === "established", "obs3 established");
assert(t3.disclosure_plan.show_situation_summary === true, "obs3 situation summary");
assert(t3.pattern_label != null || /distress|pattern|clearer|together/i.test(t3.what_seems_happening ?? ""), "obs3 pattern path");
// Soft-majority emotional threads (frustrated + sad + orientable note) stay gather-first
// until baseline or timing exists — what_matters_now correctly stays null.
assert(t3.what_matters_now == null, "obs3 what matters stays null when understanding insufficient");
assert(t3.what_can_wait == null, "obs3 what can wait stays null when understanding insufficient");
assert(t3.disclosure_plan.max_questions <= 1, "obs3 max 1 question");
const evo = evaluateResponseEvolution({
  relation: t3.relation,
  effect: t3.understanding_effect,
  resolvedCount: t3.resolved_uncertainties.length,
  priorSummary: crs2!.situation_summary,
  nextSummary: t3.what_seems_happening,
  priorMatters: crs2!.what_matters_now,
  nextMatters: t3.what_matters_now,
  patternLabel: t3.pattern_label,
  priorPattern: crs2!.pattern_label,
});
assert(typeof evo.introduces_new_pattern === "boolean", "evolution flags present");
assert(typeof evo.invalidates_previous_understanding === "boolean", "invalidate flag");
console.log("✓ obs3 → established disclosure + evolution flags");

const earlyPlan = buildDisclosurePlan("early");
const growingPlan = buildDisclosurePlan("growing");
assert(earlyPlan.show_evidence === false, "early hides evidence");
assert(earlyPlan.show_attention_level === false, "early hides low attention by default");
assert(growingPlan.show_what_matters_now === true, "growing shows matters");
assert(growingPlan.show_attention_level === true, "growing may show attention");
assert(earlyPlan.primary_question.length > 0, "primary question early");
console.log("✓ disclosure plans");

// Explicit clear (not Done-for-now pause) clears CRS with ACS
clearActiveCareSituation("cg_crs");
assert(getCareRealityState("cg_crs") == null, "explicit clear clears CRS");
console.log("✓ Explicit ACS clear clears Care Reality State");

// Pipeline + LCR progressive disclosure
resetActiveCareSituationStore();
resetCareRealityStateStore();
resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetNormalizationStore();
resetPolicyEngineStore();
seedVerifyConsent("cg_crs_pipe");

const p1 = await processSituationInput({
  raw_input: "Mom seems frustrated.",
  caregiver_id: "cg_crs_pipe",
  timestamp: "2026-07-16T14:00:00.000Z",
});
const v1 = buildLivingCareRecordResponse({
  response: p1,
  rawInput: "Mom seems frustrated.",
});
assert(v1.disclosure_stage === "early", "LCR early");
assert(v1.what_changed_in_understanding == null, "LCR early hides delta");
assert(v1.what_will_be_remembered.length === 0, "LCR early hides remembered");
assert(v1.care_reality_state_id != null, "LCR has CRS id");

const p2 = await processSituationInput({
  raw_input: "She seems sad.",
  caregiver_id: "cg_crs_pipe",
  timestamp: "2026-07-16T14:05:00.000Z",
});
const v2 = buildLivingCareRecordResponse({
  response: p2,
  rawInput: "She seems sad.",
});
assert(v2.disclosure_stage === "early", "LCR soft note 2 stays early");
assert(v2.disclosure_plan.show_what_matters_now === false, "LCR soft note 2 hides Clarity");
// Identity question ("Who is this situation about?") is allowed when subject is unknown.
// No care-content quiz questions should appear for soft notes.
assert(
  !v2.what_needs_context.some((q) => /usual|normally|different|when did|what else|timing|baseline/i.test(q)),
  "LCR soft note 2 no care-content quiz",
);

const p3 = await processSituationInput({
  raw_input: "She keeps saying she wants to go home.",
  caregiver_id: "cg_crs_pipe",
  timestamp: "2026-07-16T14:10:00.000Z",
});
const v3 = buildLivingCareRecordResponse({
  response: p3,
  rawInput: "She keeps saying she wants to go home.",
});
assert(v3.disclosure_stage === "established", "LCR established");
// Soft-majority emotional threads with insufficient understanding correctly keep
// clarity pillars null — obs count alone never unlocks Clarity.
assert(v3.what_matters_now == null && v3.what_can_wait == null, "LCR clarity pillars stay null when understanding insufficient");
assert(v3.what_needs_context.length <= 1, "LCR at most one clarifying ask");
console.log("✓ pipeline + LCR progressive disclosure");

const panel = fs.readFileSync(
  path.join(process.cwd(), "src/components/mvp-workspace/LivingCareRecordPanel.tsx"),
  "utf8",
);
assert(panel.includes("What to watch"), "panel shows what to watch");
assert(panel.includes("Can wait"), "panel shows what can wait");
assert(panel.includes("May need attention later"), "panel shows may need attention later");
assert(
  panel.includes("Questions to resolve") ||
    panel.includes("What to ask next") ||
    panel.includes("One thing that would help") ||
    panel.includes("Still unclear"),
  "panel optional ask — not interview",
);
console.log("✓ caregiver panel clarity pillars");

console.log("\n=== Care Reality State + Product Identity: all checks passed ===\n");
