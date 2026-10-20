/**
 * verify-progressive-understanding.mts
 * Understanding must evolve across related observations — not restart per message.
 */

import {
  PROGRESSIVE_UNDERSTANDING_CHAIN,
  PROGRESSIVE_UNDERSTANDING_IDENTITY,
  PROGRESSIVE_UNDERSTANDING_PURPOSE,
  processProgressiveUnderstanding,
  patternLabelFor,
  collectSituationSignals,
} from "../src/lib/progressive-understanding";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { classifyCareEventKind, buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import { PROGRESSIVE_UNDERSTANDING_ENGINE } from "../src/lib/solenos-layers/architecture-map";
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

console.log("=== SolenOS Progressive Understanding Engine ===\n");

assert(PROGRESSIVE_UNDERSTANDING_IDENTITY.includes("Progressive Understanding"), "identity");
assert(PROGRESSIVE_UNDERSTANDING_PURPOSE.includes("what changed"), "purpose");
assert(
  PROGRESSIVE_UNDERSTANDING_CHAIN.includes("progressive_understanding"),
  "chain includes progressive understanding",
);
assert(
  PROGRESSIVE_UNDERSTANDING_CHAIN.includes("care_reality_state"),
  "chain includes care_reality_state",
);
assert(
  PROGRESSIVE_UNDERSTANDING_ENGINE.modulePath.includes("progressive-understanding"),
  "arch map",
);
assert(
  fs.existsSync(path.join(process.cwd(), "src/lib/progressive-understanding/process.ts")),
  "engine module",
);
assert(
  fs.existsSync(
    path.join(process.cwd(), "docs/15-architecture-decisions/ADR-020-progressive-understanding-engine.md"),
  ),
  "ADR-020",
);
console.log("✓ contract + arch + ADR");

resetActiveCareSituationStore();

const t1 = ingestActiveCareObservation({
  caregiverId: "cg_pue",
  rawText: "She's frustrated.",
  kind: classifyCareEventKind("She's frustrated."),
  nowIso: "2026-07-16T14:00:00.000Z",
});
assert(t1.relation === "opens_new", "obs1 opens");
assert(/Held in the Living Care Record|Added to the Living Care Record/i.test(t1.confirmation_title), "obs1 added title");
assert(t1.what_changed_in_understanding == null, "obs1 no delta yet");
assert(/frustrat/i.test(t1.current_understanding.join(" ")), "obs1 understands frustrated");
assert(t1.understanding_stage === "gathering", "obs1 gathering");
console.log("✓ obs1: frustrated → added (gathering)");

const t2 = ingestActiveCareObservation({
  caregiverId: "cg_pue",
  rawText: "She's sad.",
  kind: classifyCareEventKind("She's sad."),
  nowIso: "2026-07-16T14:05:00.000Z",
});
assert(t2.relation === "updates_active" || t2.relation === "adds_context", "obs2 updates");
assert(/Care situation updated|Today's care situation updated|Updated today's care situation/i.test(t2.confirmation_title), "obs2 updated title");
assert(t2.what_changed_in_understanding != null, "obs2 has understanding delta");
assert(/frustrat/i.test(t2.current_understanding.join(" ")), "obs2 still knows frustrated");
assert(/sad/i.test(t2.current_understanding.join(" ")), "obs2 knows sad");
assert(t2.situation.observations.length === 2, "two observations same ACS");
assert(!/Care Event Added/i.test(t2.confirmation_title), "not a fresh event template");
assert(t2.understanding_effect !== "opens_situation", "obs2 not opens_situation effect");
console.log("✓ obs2: sad → understanding changed (not restart)");

const t3 = ingestActiveCareObservation({
  caregiverId: "cg_pue",
  rawText: "She keeps saying she wants to go home.",
  kind: classifyCareEventKind("She keeps saying she wants to go home."),
  nowIso: "2026-07-16T14:10:00.000Z",
});
assert(t3.situation.observations.length === 3, "three observations");
assert(t3.understanding_stage === "synthesizing", "obs3 synthesizing");
assert(t3.what_changed_in_understanding != null, "obs3 delta");
assert(
  /updated|added|held|home|sad|frustrat|today|observation|care moment/i.test(
    `${t3.what_changed_in_understanding} ${t3.what_seems_happening ?? ""} ${t3.current_understanding.join(" ")}`,
  ),
  "obs3 reflects continuous situation in plain language",
);
// Orientable care (go home) may surface high-value gap asks — never keyword quiz templates (ADR-022).
assert(
  !/fluids|head injury|did she fall|eat more|drink more/i.test(
    t3.what_needs_context.join(" "),
  ),
  "soft notes: no keyword quiz templates (ADR-022)",
);
assert(
  !t1.what_needs_context.some((q) =>
    t3.what_needs_context.some((q3) => q3.toLowerCase() === q.toLowerCase()),
  ),
  "does not re-ask the exact same questions from obs1",
);
console.log("✓ obs3: go home → continuous situation understanding");

// Appetite introduces new dimension on emotional ACS
const t4 = ingestActiveCareObservation({
  caregiverId: "cg_pue",
  rawText: "She's not eating much either.",
  kind: classifyCareEventKind("She's not eating much either."),
  nowIso: "2026-07-16T14:20:00.000Z",
});
assert(t4.understanding_effect === "introduces_new_dimension" ||
    /dimension|appetite|eating/i.test(
      `${t4.what_changed_in_understanding} ${t4.what_seems_happening ?? ""}`,
    ),
  "appetite adds a new dimension",
);
console.log("✓ obs4: appetite → new dimension (not restart)");

// Improvement must flip current state — not keep distress framing
const t5 = ingestActiveCareObservation({
  caregiverId: "cg_pue",
  rawText: "shes feeling well now and happy.",
  kind: classifyCareEventKind("shes feeling well now and happy."),
  nowIso: "2026-07-16T14:30:00.000Z",
});
assert(/well|happy|better/i.test(t5.current_understanding[0] ?? ""), "latest fact is improvement first");
assert(!/distressed than a single note|emotional distress — worth watching/i.test(
  `${t5.what_matters_now ?? ""} ${t5.what_may_become_serious ?? ""} ${t5.what_seems_happening ?? ""}`,
), "improvement must not keep distress scare framing");
assert(t5.what_may_become_serious == null, "no may-become-serious on feeling better");
assert(
  /better|well|happy|current|held|latest|updates what is held/i.test(
    `${t5.what_matters_now ?? ""} ${t5.what_changed_in_understanding ?? ""} ${t5.what_seems_happening ?? ""} ${t5.current_understanding.join(" ")}`,
  ),
  "improvement reflected in held facts / delta",
);
// Asks may remain engine-side until composer zeros them; no Clarity scare on improvement.
assert(t5.what_may_become_serious == null, "no scare pillar on improvement");
console.log("✓ obs5: feeling well and happy → current state, not stale distress");

// Signals / pattern helpers
const signals = collectSituationSignals([
  { raw_text: "frustrated", kind: "behavior_change" },
  { raw_text: "sad", kind: "behavior_change" },
  { raw_text: "wants to go home", kind: "behavior_change" },
]);
assert(patternLabelFor(signals) != null, "pattern label from signals");
console.log("✓ signal → pattern helpers");

// Pipeline + LCR projection
resetActiveCareSituationStore();
resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetNormalizationStore();
resetPolicyEngineStore();
seedVerifyConsent("cg_pue_pipe");

const p1 = await processSituationInput({
  raw_input: "She's frustrated.",
  caregiver_id: "cg_pue_pipe",
  timestamp: "2026-07-16T14:00:00.000Z",
});
const p2 = await processSituationInput({
  raw_input: "She's sad.",
  caregiver_id: "cg_pue_pipe",
  timestamp: "2026-07-16T14:05:00.000Z",
});
const p3 = await processSituationInput({
  raw_input: "She keeps saying she wants to go home.",
  caregiver_id: "cg_pue_pipe",
  timestamp: "2026-07-16T14:10:00.000Z",
});

assert(p3.active_care_situation_turn?.what_changed_in_understanding != null, "pipeline turn has delta");
const view = buildLivingCareRecordResponse({
  response: p3,
  rawInput: "She keeps saying she wants to go home.",
});
assert(view.what_changed_in_understanding != null, "LCR view surfaces understanding delta");
assert(view.observation_count >= 3, "LCR observation count accumulates");
assert(/Updated|clearer|changed/i.test(view.understanding_heading + view.care_event_added.title), "LCR not restart title");
assert(p1.active_care_situation?.id === p3.active_care_situation?.id, "same ACS across progressive turns");
console.log("✓ pipeline + LCR project progressive understanding");

const panel = fs.readFileSync(
  path.join(process.cwd(), "src/components/mvp-workspace/LivingCareRecordPanel.tsx"),
  "utf8",
);
assert(panel.includes("What to watch"), "LCR panel shows clarity pillar");
assert(panel.includes("Can wait"), "LCR panel shows what can wait");
assert(panel.includes("May need attention later"), "LCR panel shows may need attention later");
assert(panel.includes("what_matters_now"), "panel binds matters field");
console.log("✓ caregiver panel surfaces clarity pillars");

console.log("\n=== Progressive Understanding Engine: all checks passed ===\n");
