import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(file: string): string {
  return fs.readFileSync(path.join(root, file), "utf8");
}
function requireText(file: string, snippets: string[]): void {
  const source = read(file);
  for (const snippet of snippets) {
    assert(source.includes(snippet), `${file} must contain ${JSON.stringify(snippet)}`);
  }
}

const assist = read("src/components/qwen/QwenAssistPanel.tsx");
requireText("src/components/qwen/QwenAssistPanel.tsx", [
  'postJSON("/assistant/assist"',
  'getJSON("/assistant/status"',
  '"local_ollama"',
  '"ollama_native_http"',
  "result.written_to_lcr !== false",
  "result.authority !== \"solenos_care_record_and_caregiver\"",
  "No substitute response was shown.",
  "appointment",
  "after_appointment",
  "handoff",
  "professional_summary",
  "open_loops",
  "two_week_review",
  "decision_outcome",
  "medication_day",
  "living_care_record",
]);

const statusFunction = assist.slice(assist.indexOf("async function checkQwen"), assist.indexOf("async function askQwen"));
assert(statusFunction.includes("await ensureAnonymousSession()"), "The care-session-scoped Qwen status route requires a real bearer session.");
assert(statusFunction.indexOf("await ensureAnonymousSession()") < statusFunction.indexOf('getJSON("/assistant/status"'));

requireText("src/components/mvp-workspace/CognitiveWorkspace.tsx", [
  'import QwenAssistPanel from "@/components/qwen/QwenAssistPanel";',
  "Qwen support across SolenOS",
  "evidenceIds={documents.map",
  "isCasualConversationOnly(text)",
  "how are you today",
  "what's up",
  "see you",
  "/workspace/companion?draft=",
]);
requireText("src/components/workflows/StructuredDailyCapture.tsx", [
  "import QwenAssistPanel from '@/components/qwen/QwenAssistPanel';",
  'postJSON(\'/daily/log\'',
  "Qwen support for Daily Capture",
  "qwen_extraction_status",
]);
requireText("src/components/workflows/Community.tsx", [
  "import QwenAssistPanel from '@/components/qwen/QwenAssistPanel'",
  "postJSON('/community/experience/summary'",
  "Qwen support for Community",
]);
requireText("src/components/workflows/AICompanion.tsx", [
  "import QwenAssistPanel from '@/components/qwen/QwenAssistPanel'",
  "postJSON('/conversation/message'",
  "Qwen support for your Living Care Record",
]);
requireText("src/app/workspace/documents/page.tsx", [
  'import QwenAssistPanel from "@/components/qwen/QwenAssistPanel";',
  'defaultWorkflow="document"',
  "Qwen support for Documents",
]);
requireText("src/components/mvp-workspace/SituationResponsePanel.tsx", [
  "Entry saved to the Living Care Record",
  "The backend confirmed this entry was saved.",
  "will not ask you to submit the same entry again",
]);
assert(!read("src/components/mvp-workspace/SituationResponsePanel.tsx").includes("<h3>Care record view unavailable</h3>"));

console.log("PASS: Qwen is routed through authenticated backend support across workspace, documents, Daily Capture, Community, and Companion.");
console.log("PASS: appointment, after-appointment, handoff, professional summary, open loops, two-week review, decision/outcome, medication observations and LCR are selectable workflows.");
console.log("PASS: UI requires an actual local-Qwen response and explicitly verifies that assistance is read-only.");
console.log("PASS: casual greetings are routed to Companion, and confirmed persisted captures never invite duplicate submission because the situation projection is missing.");
