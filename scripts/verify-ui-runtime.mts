import {
  UI_RUNTIME_IDENTITY,
  UI_RUNTIME_ONE_LINE_TRUTH,
  UI_EVENT_LOOP_STAGES,
  DECISION_RISK_LEVELS,
  SITUATION_STATUSES,
  TIMELINE_ENTRY_TYPES,
  SIDEBAR_SECTION_IDS,
  CAREGIVER_SIDEBAR_SECTION_IDS,
  CAREGIVER_SIDEBAR_SECTION_LABELS,
  OPS_SIDEBAR_SECTION_IDS,
  FORBIDDEN_UI_PATTERNS,
  UI_RUNTIME_DESIGN_PRINCIPLE,
  mapSolenOSToDecisionCard,
  createEmptyTimeline,
  appendTimelineEntry,
  TIMELINE_MUTATION_FORBIDDEN,
  applyInferenceCycle,
  createEmptyUiRuntimeState,
  assertSingleActiveDecisionCard,
  listActiveSituations,
  createSituation,
  openSituationsFromSituationApi,
} from "../src/lib/ui-runtime";
import { VERIFY_VALID_SOLENOS, VERIFY_SEMANTIC_ROLE_EXAMPLE } from "./fixtures/solenos-valid";
import fs from "node:fs";
import path from "node:path";

console.log("=== SolenOS — UI Runtime Architecture ===\n");

if (!UI_RUNTIME_IDENTITY.toLowerCase().includes("care journey")) {
  throw new Error("UI runtime identity must declare care journey continuity");
}
if (!UI_RUNTIME_ONE_LINE_TRUTH.includes("Replace Decision Card")) {
  throw new Error("UI event loop must end with decision replace + timeline + situation update");
}
console.log("✓ UI runtime identity + event loop contract");

if (UI_EVENT_LOOP_STAGES.length !== 12) {
  throw new Error(`expected 12 UI event loop stages, found ${UI_EVENT_LOOP_STAGES.length}`);
}
if (UI_EVENT_LOOP_STAGES[0] !== "user_input") {
  throw new Error("event loop must start with user_input");
}
if (UI_EVENT_LOOP_STAGES.at(-1) !== "update_situation") {
  throw new Error("event loop must end with update_situation");
}
console.log("✓ UI event loop stages ordered");

if (SIDEBAR_SECTION_IDS.length !== 13) {
  throw new Error(`expected 13 sidebar sections, found ${SIDEBAR_SECTION_IDS.length}`);
}
if (SIDEBAR_SECTION_IDS[0] !== "active_situations") {
  throw new Error("active_situations must be first sidebar section");
}
if (SIDEBAR_SECTION_IDS.at(-1) !== "about_solenos") {
  throw new Error("about_solenos must be last sidebar section");
}
const expectedSections = [
  "active_situations",
  "observations",
  "care_profile",
  "care_context",
  "timeline",
  "memory",
  "documents",
  "responsibility_graph",
  "safety_settings",
  "system_settings",
  "feedback_corrections",
  "system_health",
  "about_solenos",
];
if (SIDEBAR_SECTION_IDS.join(",") !== expectedSections.join(",")) {
  throw new Error("sidebar section order drift");
}
console.log("✓ sidebar section order (13)");

if (CAREGIVER_SIDEBAR_SECTION_IDS.join(",") !== "active_situations,timeline,about_solenos") {
  throw new Error("caregiver sidebar must be open situations + timeline + about only");
}
if (CAREGIVER_SIDEBAR_SECTION_LABELS.active_situations !== "Open situations") {
  throw new Error("caregiver label must be plain-language Open situations");
}
if (!OPS_SIDEBAR_SECTION_IDS.includes("system_health")) {
  throw new Error("ops sidebar must include system_health");
}
if (!OPS_SIDEBAR_SECTION_IDS.includes("responsibility_graph")) {
  throw new Error("ops sidebar must include responsibility_graph");
}
if (!UI_RUNTIME_DESIGN_PRINCIPLE.toLowerCase().includes("ops")) {
  throw new Error("design principle must ops-gate caregiver chrome");
}
console.log("✓ caregiver vs ops sidebar split");

const fromGroups = openSituationsFromSituationApi({
  care_situation_groups: [
    { situation_id: "acs_1", root_event_id: "e1", event_ids: ["e1", "e2"] },
  ],
  context: {
    events: [
      { id: "e1", raw_input: "She's frustrated.", situation_id: "acs_1" },
      { id: "e2", raw_input: "She's sad.", situation_id: "acs_1" },
    ],
  },
});
if (fromGroups.length !== 1) {
  throw new Error("care_situation_groups must yield open situations when TrackedSituation empty");
}
if (!/frustrat|sad/i.test(fromGroups[0]!.title)) {
  throw new Error("open situation title must come from caregiver words");
}
console.log("✓ open situations from care_situation_groups");

const sidebarSrc = fs.readFileSync(
  path.join(process.cwd(), "src/components/ui-runtime/Sidebar.tsx"),
  "utf8",
);
if (!sidebarSrc.includes("opsMode")) {
  throw new Error("Sidebar must accept opsMode");
}
if (!sidebarSrc.includes("CAREGIVER_SIDEBAR_SECTION_IDS")) {
  throw new Error("Sidebar must use caregiver section list by default");
}
const pageSrc = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
if (!pageSrc.includes("openSituationsFromSituationApi")) {
  throw new Error("page must hydrate open situations from real care data");
}
if (!pageSrc.includes("/api/ops/access")) {
  throw new Error("page must ops-gate via /api/ops/access");
}
console.log("✓ caregiver chrome wiring");

if (DECISION_RISK_LEVELS.join(",") !== "LOW,MEDIUM,HIGH") {
  throw new Error("DecisionCard risk levels must be LOW|MEDIUM|HIGH");
}
if (SITUATION_STATUSES.join(",") !== "active,blocked,waiting,resolved") {
  throw new Error("situation status contract drift");
}
if (TIMELINE_ENTRY_TYPES.join(",") !== "decision,document,correction,system_event,demand_completed") {
  throw new Error("timeline entry types drift");
}
console.log("✓ DecisionCard / Situation / Timeline type contracts");

const card = mapSolenOSToDecisionCard({
  situationId: "sit-1",
  response: VERIFY_VALID_SOLENOS,
});
if (card.nextBestAction !== VERIFY_VALID_SOLENOS.what_to_ask_next) {
  throw new Error("what_to_ask_next must map to nextBestAction");
}
if (card.whatIsHappening !== VERIFY_VALID_SOLENOS.what_is_happening) {
  throw new Error("what_is_happening mapping failed");
}
if (card.riskLevel !== "MEDIUM") {
  throw new Error("medium risk must map to MEDIUM");
}
if (!Array.isArray(card.whatCanWait) || card.whatCanWait.length === 0) {
  throw new Error("what_can_wait must become whatCanWait string[]");
}

const multiQ = mapSolenOSToDecisionCard({
  situationId: "sit-2",
  response: VERIFY_SEMANTIC_ROLE_EXAMPLE,
});
if (multiQ.unresolvedQuestions.length < 2) {
  throw new Error("multi-question what_to_ask_next should yield unresolvedQuestions");
}
console.log("✓ SolenOSResponse → DecisionCard mapping");

const withTrust = mapSolenOSToDecisionCard({
  situationId: "sit-trust",
  response: VERIFY_VALID_SOLENOS,
  explanation: {
    whyThisWasChosen: "This step ranked highest by pressure.",
    whatWasIgnored: ["A lower-pressure follow-up"],
    riskIfIgnored: "Waiting leaves the same pressure unresolved.",
  },
  reversibility: {
    canUndo: true,
    canIgnore: true,
    canChooseAlternative: true,
    undoLabel: "Undo this recommendation",
    ignoreLabel: "Ignore for now",
    chooseAlternativeLabel: "Choose a different option",
    alternatives: [{ id: "alt-1", label: "A lower-pressure follow-up" }],
    supportedActions: ["undo", "ignore", "choose_alternative"],
  },
});
if (!withTrust.explanation?.whyThisWasChosen) {
  throw new Error("DecisionCard must carry Human Trust explanation when provided");
}
if (!withTrust.reversibility?.canUndo) {
  throw new Error("DecisionCard must carry reversibility affordances when provided");
}
console.log("✓ DecisionCard Human Trust explanation + reversibility mapping");

let timeline = createEmptyTimeline();
timeline = appendTimelineEntry(timeline, {
  type: "decision",
  summary: "First decision",
  situationId: "sit-1",
  timestamp: "2026-01-01T10:00:00.000Z",
});
timeline = appendTimelineEntry(timeline, {
  type: "system_event",
  summary: "Session bound",
  situationId: "sit-1",
  timestamp: "2026-01-01T10:01:00.000Z",
});
if (timeline.entries.length !== 2) {
  throw new Error("timeline append must grow log");
}
if (timeline.entries[0].summary !== "First decision") {
  throw new Error("timeline must be append-only chronological retention");
}
for (const forbidden of TIMELINE_MUTATION_FORBIDDEN) {
  const storeSource = fs.readFileSync("src/lib/ui-runtime/timeline-store.ts", "utf-8");
  if (
    storeSource.includes(`export function ${forbidden}`) ||
    storeSource.includes(`function ${forbidden}Timeline`)
  ) {
    throw new Error(`timeline store must not expose ${forbidden}`);
  }
}
console.log("✓ timeline append-only immutability");

const prior = createEmptyUiRuntimeState();
const first = applyInferenceCycle(prior, {
  userInput: "Mom missed evening medication",
  response: VERIFY_VALID_SOLENOS,
});
assertSingleActiveDecisionCard(first.state.decisionSurface);
if (!first.state.decisionSurface.activeCard) {
  throw new Error("first inference must set active decision card");
}
if (first.previousCardReplaced) {
  throw new Error("first inference should not report replacement");
}

const second = applyInferenceCycle(first.state, {
  userInput: "Still unsure about the dose",
  response: VERIFY_SEMANTIC_ROLE_EXAMPLE,
  situationId: first.state.activeSituationId,
});
if (!second.previousCardReplaced) {
  throw new Error("second inference must replace previous DecisionCard");
}
if (second.state.decisionSurface.activeCard?.whatIsHappening !== VERIFY_SEMANTIC_ROLE_EXAMPLE.what_is_happening) {
  throw new Error("replacement must swap to new card contents");
}
if (second.state.timeline.entries.length !== 2) {
  throw new Error("each inference must append exactly one decision timeline entry");
}
if (second.state.situations.length !== 1) {
  throw new Error("same situationId must update in place, not duplicate");
}
const actives = listActiveSituations(second.state.situations);
if (actives.length !== 1 || actives[0].id !== second.state.activeSituationId) {
  throw new Error("active situations projection failed");
}
console.log("✓ DecisionCard replace + situation update + timeline append");

const resolved = createSituation({ title: "Done", status: "resolved", riskLevel: "LOW" });
if (listActiveSituations([resolved]).length !== 0) {
  throw new Error("resolved situations must not appear in active list");
}
console.log("✓ active situations excludes resolved");

const uiRuntimeFiles = [
  "src/lib/ui-runtime",
  "src/components/ui-runtime",
  "src/app/page.tsx",
].flatMap((target) => {
  const abs = path.resolve(target);
  if (fs.statSync(abs).isDirectory()) {
    return (fs.readdirSync(abs, { recursive: true }) as string[])
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => path.join(abs, f));
  }
  return [abs];
});

const forbiddenTokens = [
  "chat-bubble",
  "chatBubble",
  "message-bubble",
  "conversation-thread",
  "ConversationThread",
  "AI personality",
  "typing indicator",
];
for (const file of uiRuntimeFiles) {
  const content = fs.readFileSync(file, "utf-8");
  for (const token of forbiddenTokens) {
    if (content.includes(token)) {
      throw new Error(`${path.relative(process.cwd(), file)} contains forbidden UI token: ${token}`);
    }
  }
}
for (const pattern of FORBIDDEN_UI_PATTERNS) {
  if (!pattern.includes(" ")) continue;
}
console.log("✓ no chat-bubble / conversation-thread patterns in UI runtime surfaces");

const pageSource = fs.readFileSync("src/app/page.tsx", "utf-8");
for (const region of ["Sidebar", "CognitiveWorkspace"]) {
  if (!pageSource.includes(region)) {
    throw new Error(`page.tsx must compose caregiver UI region: ${region}`);
  }
}
if (!pageSource.includes("opsMode")) {
  throw new Error("page must pass opsMode into Sidebar");
}
if (pageSource.includes("LiveDecisionSurface")) {
  throw new Error("caregiver page must not mount LiveDecisionSurface ops surface");
}
console.log("✓ page region mapping: caregiver Sidebar + CognitiveWorkspace (ops-gated)");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8")) as {
  scripts: Record<string, string>;
};
if (!pkg.scripts["verify:ui-runtime"]) {
  throw new Error("package.json must define verify:ui-runtime");
}
console.log("✓ verify:ui-runtime script registered");

console.log("\n=== UI Runtime Architecture: ALL CHECKS PASSED ===");
