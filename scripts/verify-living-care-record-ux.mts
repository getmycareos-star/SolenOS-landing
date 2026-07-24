/**
 * verify-living-care-record-ux.mts
 * Caregiver-facing Living Care Record response — not AI reasoning dump.
 */

import fs from "node:fs";
import path from "node:path";

import {
  LIVING_CARE_RECORD_DEFAULT_SECTIONS,
  LIVING_CARE_RECORD_FORBIDDEN_UI_TERMS,
  LIVING_CARE_RECORD_UX_IDENTITY,
  buildLivingCareRecordResponse,
  clarificationQuestionsForKind,
  classifyCareEventKind,
  isCaregiverSafeDisplayText,
} from "../src/lib/living-care-record-ux";
import { LIVING_CARE_RECORD_UX } from "../src/lib/solenos-layers/architecture-map";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { resetActiveCareSituationStore } from "../src/lib/active-care-situation";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Living Care Record UX ===\n");

assert(LIVING_CARE_RECORD_UX_IDENTITY.includes("Living Care Record"), "identity");
assert(LIVING_CARE_RECORD_DEFAULT_SECTIONS.length === 4, "four default sections");
assert(LIVING_CARE_RECORD_UX.modulePath.includes("living-care-record-ux"), "arch map");
assert(classifyCareEventKind("Mom fell yesterday") === "fall", "fall kind");
assert(
  classifyCareEventKind("She started crying") === "behavior_change",
  "started crying is behavior, not medication",
);
assert(
  classifyCareEventKind("things changed today") === "general" ||
    classifyCareEventKind("things changed today") === "behavior_change",
  "bare changed is not medication",
);
assert(
  classifyCareEventKind("Doctor changed her blood pressure pill") === "medication_change",
  "pill/med lexicon still medication",
);
assert(
  clarificationQuestionsForKind("fall").length === 0,
  "fall kind has no template quiz",
);
assert(
  clarificationQuestionsForKind("appetite").length === 0,
  "appetite kind has no template quiz",
);
assert(
  clarificationQuestionsForKind("document").length === 0,
  "document kind has no interview quiz",
);
assert(
  clarificationQuestionsForKind("behavior_change").length === 0,
  "behavior kind has no interview quiz",
);
assert(!isCaregiverSafeDisplayText("ambiguous_extraction found"), "blocks jargon");
assert(!isCaregiverSafeDisplayText("confidence 58%"), "blocks percent confidence");
console.log("✓ contract + clarifiers");

const required = [
  "src/lib/living-care-record-ux/index.ts",
  "src/components/mvp-workspace/LivingCareRecordPanel.tsx",
  "docs/15-architecture-decisions/ADR-019-living-care-record-ux.md",
];
for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const panel = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/SituationResponsePanel.tsx"),
  "utf8",
);
assert(panel.includes("LivingCareRecordPanel"), "SituationResponsePanel uses LCR panel");
assert(!panel.includes("Technical detail"), "no Technical detail in caregiver panel");
assert(!panel.includes("FinalOutputPanel"), "no FinalOutputPanel in caregiver panel");
assert(!panel.includes("RuntimeArbitrationPanel"), "no arbitration dump in caregiver panel");
assert(!/from \"\.\/FinalOutputPanel\"/.test(panel), "no engine panel imports");
assert(!panel.includes("clarity-side"), "no clarity-side chrome class");

const lcrPanel = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/LivingCareRecordPanel.tsx"),
  "utf8",
);
assert(
  /What is understood about this situation|What is happening|What we know so far/.test(lcrPanel),
  "ADR-019: what understood section",
);
assert(
  /Still unclear|What to ask next|What would help understand|One thing that would help/.test(lcrPanel),
  "ADR-019: needs context (Still unclear — unknowns as care reality)",
);
assert(/What will be remembered/.test(lcrPanel), "ADR-019: remembered section");
assert(!/>\s*Clarity\s*</.test(lcrPanel) && !/section-kicker">\s*Clarity/.test(lcrPanel), "no Clarity analysis kicker — AI invisible");
assert(/What matters/.test(lcrPanel), "progressive what-matters without Clarity branding");
assert(!/I will not ask/.test(lcrPanel), "no first-person assistant voice in panel");
assert(/What supports this understanding/.test(lcrPanel), "expandable evidence quiet, not engine dump");

const workspace = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
  "utf8",
);
assert(workspace.includes("handleDoneForNow"), "Done for now uses dedicated handler");
assert(
  !workspace.includes('from "@/lib/active-care-situation"'),
  "Done must not import ACS durable/fs into client bundle",
);
assert(workspace.includes("pause_active_care_situation"), "Done pauses ACS on server");
assert(
  /setEntryMode\(obsCount > 1 \? "update" : "initial"\)/.test(workspace) ||
    /setEntryMode\(obs > 1 \? "update" : "initial"\)/.test(workspace),
  "composer mode follows ACS observation count (opens_new stays initial)",
);
assert(
  /observations\?\.length/.test(workspace),
  "composer framing keys off Active Care Situation observations",
);
assert(
  /setSessionHasNote\(true\)/.test(workspace) &&
    !/Done for now[\s\S]{0,800}setSessionHasNote\(false\)/.test(workspace),
  "Done for now keeps continuity — never resets first-time UX",
);
assert(!/fetch\(\s*[`"']\/api\/analyze[`"']/.test(workspace), "workspace must not fetch analyze");
assert(!workspace.includes('"/api/analyze"'), "workspace must not hardcode analyze URL");
assert(!workspace.includes("'/api/analyze'"), "workspace must not hardcode analyze URL");
assert(!workspace.includes("`/api/analyze`"), "workspace must not hardcode analyze URL");
assert(!workspace.includes("handleClearMyHead"), "no Clear My Head handler");
assert(!workspace.includes("handleContinueToClarity"), "no Continue-to-Clarity");
assert(!workspace.includes("ClarityPanel"), "no ClarityPanel in caregiver workspace");
assert(!workspace.includes("CarryingPanel"), "no CarryingPanel envelope path");
assert(!workspace.includes("ContinuityPanel"), "no ContinuityPanel in caregiver workspace");
assert(!workspace.includes("FinalOutputPanel"), "no FinalOutputPanel in caregiver workspace");
assert(!workspace.includes("ReasoningSection"), "no ReasoningSection in caregiver workspace");
assert(!workspace.includes("ops-clarity"), "caregiver workspace must not import ops-clarity");
assert(!workspace.includes("ops-devtools"), "caregiver workspace must not import ops-devtools");
assert(!workspace.includes("TrustProvenancePanel"), "no TrustProvenance in caregiver workspace");
assert(!workspace.includes("ClarificationEnginePanel"), "no ClarificationEngine in caregiver workspace");
assert(!workspace.includes("ContinuityDecayPanel"), "no ContinuityDecay in caregiver workspace");
assert(!workspace.includes("ObservationPanel"), "no ObservationPanel signals in caregiver workspace");
assert(!workspace.includes("onAnalyzeComplete"), "no analyze sidebar wiring from workspace");
assert(workspace.includes("/api/situation"), "workspace uses situation entry");

{
  const { CAREGIVER_MVP_WORKSPACE_FILES } = await import("../src/lib/mvp-workspace/caregiver-surface");
  const mvpFiles = fs
    .readdirSync(path.join(root, "src/components/mvp-workspace"))
    .filter((f) => !f.startsWith("."))
    .sort();
  const allow = [...CAREGIVER_MVP_WORKSPACE_FILES].sort();
  assert(
    mvpFiles.length === allow.length && mvpFiles.every((f, i) => f === allow[i]),
    `mvp-workspace must only contain caregiver allowlist (found: ${mvpFiles.join(", ")})`,
  );
  assert(
    fs.existsSync(path.join(root, "src/components/ops-devtools/TrustProvenancePanel.tsx")),
    "TrustProvenance quarantined under ops-devtools",
  );
  assert(
    fs.existsSync(path.join(root, "src/components/ops-devtools/ClarificationEnginePanel.tsx")),
    "ClarificationEngine quarantined under ops-devtools",
  );
  assert(
    fs.existsSync(path.join(root, "src/components/ops-devtools/ContinuityDecayPanel.tsx")),
    "ContinuityDecay quarantined under ops-devtools",
  );
  assert(
    fs.existsSync(path.join(root, "src/components/ops-devtools/ObservationPanel.tsx")),
    "ObservationPanel signals quarantined under ops-devtools",
  );
  assert(
    !fs.existsSync(path.join(root, "src/components/ui-runtime/ObservationPanel.tsx")),
    "ObservationPanel must not remain under ui-runtime",
  );
  assert(
    fs.existsSync(path.join(root, "src/app/ops/devtools/page.tsx")),
    "ops devtools quarantine page",
  );
  assert(
    LIVING_CARE_RECORD_UX.enginePanelsQuarantine.includes("ops-devtools"),
    "arch map documents engine panels quarantine",
  );
}

const sidebarSrc = fs.readFileSync(
  path.join(root, "src/components/ui-runtime/Sidebar.tsx"),
  "utf8",
);
assert(sidebarSrc.includes("ops-devtools/ObservationPanel"), "Sidebar loads ObservationPanel from ops-devtools");
assert(sidebarSrc.includes("dynamic("), "ObservationPanel is dynamically imported (caregiver bundle split)");
assert(
  /opsMode && activeSection === ["']observations["']/.test(sidebarSrc),
  "ObservationPanel only mounts in ops mode",
);

const workspaceTypes = fs.readFileSync(
  path.join(root, "src/lib/mvp-workspace/types.ts"),
  "utf8",
);
assert(
  /WORKSPACE_STATES\s*=\s*\[\s*"REAL_MOMENT"\s*,\s*"CARRYING"\s*\]/.test(workspaceTypes),
  "caregiver WORKSPACE_STATES is REAL_MOMENT | CARRYING only",
);
{
  const statesBlock = workspaceTypes.match(
    /export const WORKSPACE_STATES = \[([\s\S]*?)\] as const/,
  );
  assert(statesBlock, "WORKSPACE_STATES export found");
  assert(!statesBlock[1].includes("CLARITY"), "CLARITY not in caregiver WORKSPACE_STATES");
  assert(!statesBlock[1].includes("CONTINUITY"), "CONTINUITY not in caregiver WORKSPACE_STATES");
}
assert(workspaceTypes.includes("OPS_QUARANTINED_WORKSPACE_STATES"), "quarantined states documented");
assert(
  fs.existsSync(path.join(root, "src/components/ops-clarity/ClarityPanel.tsx")),
  "ClarityPanel quarantined under ops-clarity",
);
assert(
  fs.existsSync(path.join(root, "src/app/ops/clarity/page.tsx")),
  "ops clarity quarantine page",
);
assert(
  !fs.existsSync(path.join(root, "src/components/mvp-workspace/ClarityPanel.tsx")),
  "ClarityPanel must not remain under mvp-workspace",
);
assert(
  LIVING_CARE_RECORD_UX.clarityDumpQuarantine.includes("ops-clarity"),
  "arch map documents Clarity dump quarantine",
);
assert(
  LIVING_CARE_RECORD_UX.caregiverWorkspaceStates.includes("REAL_MOMENT"),
  "arch map documents caregiver workspace states",
);

const analyzeRoute = fs.readFileSync(
  path.join(root, "src/app/api/analyze/route.ts"),
  "utf8",
);
assert(analyzeRoute.includes("isAnalyzePipelineEnabled"), "analyze route hard-gated");
assert(
  fs.existsSync(path.join(root, "src/lib/analyze-pipeline/caregiver-entry-gate.ts")),
  "caregiver entry gate module",
);
assert(
  LIVING_CARE_RECORD_UX.caregiverEntryPipeline.includes("/api/situation"),
  "arch map documents single entry",
);
assert(
  LIVING_CARE_RECORD_UX.activeCareSituationPersistence.includes("processSituationInput") ||
    LIVING_CARE_RECORD_UX.activeCareSituationPersistence.includes(".data/active-care-situation"),
  "arch map documents ACS server ingest",
);
assert(
  LIVING_CARE_RECORD_UX.careContextSpineLinking.includes("situation_id"),
  "arch map documents CareContext spine linking",
);
assert(
  LIVING_CARE_RECORD_UX.careContextSpineLinking.includes("server") ||
    LIVING_CARE_RECORD_UX.careContextSpineLinking.includes("same-day"),
  "arch map documents server-owned soft same-day relation",
);
assert(
  LIVING_CARE_RECORD_UX.regressionCoverage.includes("persistence"),
  "arch map documents LCR regression coverage",
);
assert(
  fs.existsSync(path.join(root, "scripts/verify-living-care-record-regression.mts")),
  "regression verify required (persistence · relation · DTO · crisis FP)",
);
assert(
  LIVING_CARE_RECORD_UX.careContextDurability.includes(".data/care-context"),
  "arch map documents CareContext durability",
);
console.log("✓ files + caregiver-only panel wiring + single entry pipeline");

resetDareStore();
resetCareContextRootStore();
resetCareEventStore();
resetPolicyEngineStore();
resetNormalizationStore();
resetActiveCareSituationStore();
seedVerifyConsent("cg_lcr_ux");

const response = await processSituationInput({
  raw_input: "Mom fell yesterday. We went to urgent care.",
  caregiver_id: "cg_lcr_ux",
  timestamp: "2026-07-16T12:00:00.000Z",
});

assert(response.active_care_situation != null, "pipeline returns ACS");
assert(response.active_care_situation_turn != null, "pipeline returns ACS turn");
assert(
  (response.active_care_situation?.observations.length ?? 0) >= 1,
  "ACS has observation from pipeline ingest",
);

const view = buildLivingCareRecordResponse({
  response,
  rawInput: "Mom fell yesterday. We went to urgent care.",
});

assert(view.care_event_added.event === "Fall", "event type Fall");
assert(view.care_event_added.date === "Yesterday", "date Yesterday");
assert(
  view.care_event_added.related_care.some((r) => /urgent care/i.test(r)),
  "related urgent care",
);
assert(
  view.what_understood.length > 0 ||
    /fell|fall|urgent care|held|Living Care Record/i.test(view.care_event_added.confirmation),
  "held confirmation or understood facts",
);
// Never fall→head keyword quiz (Response Behavior / golden scenarios).
assert(
  !view.what_needs_context.some((q) => /\bhead\b/i.test(q)),
  "no fall→head kind-template ask",
);
assert(
  view.what_needs_context.length === 0 ||
    view.what_needs_context.some((q) =>
      /noticed|usual|when|else|who is this|what do you (?:usually )?call|call (?:the )?person/i.test(
        q,
      ),
    ),
  "gap asks are understanding invites (incl. Locked A identity), not event templates",
);
assert(view.disclosure_stage === "early", "first observation is early disclosure");
assert(view.disclosure_plan.show_remembered === false, "early hides remembered");
assert(view.what_will_be_remembered.length === 0, "early: remembered deferred");
assert(view.care_reality_state_id != null, "view projects from Care Reality State");
assert(view.primary_screen_question.length > 0, "one primary screen question");
assert(!/%/.test(view.confidence_label), "no percent confidence");
assert(!/Clarity/.test(view.understanding_heading ?? ""), "no Clarity analysis heading on view");
const displayBlob = [
  view.care_event_added.confirmation,
  view.care_event_added.event,
  view.care_event_added.status,
  ...(view.care_event_added.related_care ?? []),
  ...view.what_understood,
  ...view.what_needs_context,
  ...view.what_will_be_remembered,
  view.confidence_label,
  view.original_input,
  ...(view.expandable.evidence ?? []),
  ...(view.expandable.timeline ?? []),
].join("\n");
const leaked = LIVING_CARE_RECORD_FORBIDDEN_UI_TERMS.find((t) =>
  displayBlob.toLowerCase().includes(t.toLowerCase()),
);
assert(!leaked, `no forbidden terms in caregiver display (found: ${leaked ?? "none"})`);
assert(response.crisis_mode_interaction_layer?.crisis_mode !== true, "no false crisis");
console.log("✓ fall note → Living Care Record view (no crisis, no jargon)");

// Documents use the same four-section contract
const docView = buildLivingCareRecordResponse({
  response: {
    ...response,
    document_events_count: 1,
    events_created: response.events_created,
  },
  rawInput: "[Document: discharge-summary.pdf]\nDischarged home. New meds listed.",
});
assert(docView.care_event_added.source === "document" || docView.has_documents, "document source");
assert(
  docView.what_needs_context.length > 0 || docView.what_understood.length > 0,
  "document produces caregiver sections",
);
assert(
  classifyCareEventKind("Discharged home. New meds listed.", undefined, true) ===
    "hospital_discharge",
  "document discharge content keeps clinical kind (Input Reality)",
);
assert(
  classifyCareEventKind("Lab results attached for review.", undefined, true) === "document",
  "generic document content classifies as document",
);
assert(
  clarificationQuestionsForKind("document").length === 0,
  "document shares use composer — no interview clarifiers",
);
console.log("✓ documents share Living Care Record four-section contract");

console.log("\n=== Living Care Record UX: all checks passed ===\n");
