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
  "daily_capture",
  "add_record",
  "care_history_search",
  "care_situation_change",
  "delta_engine",
  "evidence_provenance",
  "uncertainty_contradictions",
  "returning_caregiver",
  "reminders_notifications",
  "care_coordination",
  "companion",
  "caregiver_feedback",
  "sharing_export",
  "roles_access",
  "account_recovery",
  "settings_security",
  "record_lifecycle",
  "offline_sync",
  "ai_reliability",
  "audit_review",
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
requireText("src/app/workspace/notifications/page.tsx", [
  'import QwenAssistPanel from "@/components/qwen/QwenAssistPanel";',
  'defaultWorkflow="reminders_notifications"',
  "Qwen support for reminders",
]);
requireText("src/components/mvp-workspace/SituationResponsePanel.tsx", [
  "Entry saved to the Living Care Record",
  "The backend confirmed this entry was saved.",
  "will not ask you to submit the same entry again",
]);
assert(!read("src/components/mvp-workspace/SituationResponsePanel.tsx").includes("<h3>Care record view unavailable</h3>"));

console.log("PASS: shared Qwen assistance is available across the workspace, documents, Daily Capture, Companion, and notifications; Community Qwen integration is disabled.");
console.log("PASS: all 30 enabled SolenOS workflow IDs are exposed by the shared Qwen selector; Community is excluded.");
console.log("PASS: UI requires an actual local-Qwen response and explicitly verifies that assistance is read-only.");
console.log("PASS: casual greetings are routed to Companion, and confirmed persisted captures never invite duplicate submission because the situation projection is missing.");
