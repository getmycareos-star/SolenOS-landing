import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sanitizeCaregiverErrorMessage } from "../src/lib/mvp-input-architecture/first-input";

const root = process.cwd();
const companion = fs.readFileSync(path.join(root, "src/components/workflows/AICompanion.tsx"), "utf8");
const orientation = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PersistedCareOrientation.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const deltaPanel = fs.readFileSync(path.join(root, "src/components/CareDeltaPanel.tsx"), "utf8");
const dailyCapture = fs.readFileSync(path.join(root, "src/components/workflows/StructuredDailyCapture.tsx"), "utf8");
const landingStyles = fs.readFileSync(path.join(root, "src/app/landing.css"), "utf8");
const notifications = fs.readFileSync(path.join(root, "src/app/workspace/notifications/page.tsx"), "utf8");
const assistPanel = fs.readFileSync(path.join(root, "src/components/qwen/QwenAssistPanel.tsx"), "utf8");
const qwenPanel = fs.readFileSync(path.join(root, "src/components/qwen/QwenAssistPanel.tsx"), "utf8");
const workspaceComposer = fs.readFileSync(path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"), "utf8");

// Errors must be event-driven, dismissible through correction/reset, and not stale.
assert.match(companion, /\{requestError && <div className="companion-error" role="alert"/);
assert.match(companion, /setRequestError\(null\)/);
assert.match(companion, /const startNewSession = \(\) => \{[\s\S]*?setRequestError\(null\)/);
assert.match(companion, /onChange=\{event => handleInput\(event\.target\.value\)\}/);
assert.match(workspaceComposer, /setRawInput\(value\);\s*setLcrOrientationReply\(null\);\s*setCaregiverError\(null\)/);
assert.match(workspaceComposer, /setDocuments\(nextDocuments\);\s*setLcrOrientationReply\(null\);\s*setCaregiverError\(null\)/);
assert.match(sanitizeCaregiverErrorMessage("Situation hydration failed (404)"), /We couldn’t complete that step/);
assert.match(sanitizeCaregiverErrorMessage("Failed to fetch /api/situation"), /We couldn’t complete that step/);

// Internal evaluation metadata must never be rendered into the caregiver conversation.
assert.doesNotMatch(companion, /Safety: \{msg\.safety_note\}/);
assert.doesNotMatch(companion, /Guard: \{msg\.guard_verdict\}/);
assert.doesNotMatch(companion, /Confidence: \{Math\.round/);
assert.doesNotMatch(companion, /Evidence: \{msg\.evidence_ids/);
assert.doesNotMatch(companion, /Replies may be unavailable sometimes/);
assert.doesNotMatch(companion, /The safety engine flagged this exchange/);
assert.match(companion, /A few words are enough/);\nassert.match(companion, /You don’t have to figure it all out right now/);
assert.match(companion, /showPanel=\{false\}/);
assert.match(deltaPanel, /if \(!showPanel\) return null/);
assert.match(deltaPanel, /if \(!personId \|\| !showPanel\)/);

// A successful empty response is a first-visit state, not a load error.
assert.match(orientation, /Your care record is ready to build/);
assert.match(orientation, /data\.ok === false/);
assert.doesNotMatch(orientation, /!Array\.isArray\(data\.events\)/);
assert.match(orientation, /Your care information isn't available right now\. Check your connection and try again\./);
assert.doesNotMatch(orientation, /<p><\/p>/);

// Primary controls have explicit, high-contrast sage/ink tokens.
assert.match(styles, /--solenos-sage-button: #b9d5b5/);
assert.match(styles, /--solenos-button-ink: #17251c/);
assert.match(styles, /\.structured-daily-capture input[^,]*,[\s\S]*?color: #172b35 !important/);
assert.match(dailyCapture, /measured_at: toLocalDateTimeInput\(\)/);
assert.match(dailyCapture, /heart_rate: 'bpm'/);
assert.match(dailyCapture, /observed_at: toLocalDateTimeInput\(\)/);
assert.match(dailyCapture, /Added to this daily-care draft/);
assert.doesNotMatch(dailyCapture, /The backend did not provide a persistent review ID/);
assert.doesNotMatch(dailyCapture, /Failed to add vital:/);
assert.match(dailyCapture, /medicationError && <p role="alert"/);
assert.match(dailyCapture, /medicationFeedback && <p role="status"/);
assert.doesNotMatch(dailyCapture, /alert\('Medication added successfully'\)/);
assert.doesNotMatch(dailyCapture, /alert\('Scale added successfully'\)/);
assert.match(dailyCapture, /showPanel=\{false\}/);
assert.match(dailyCapture, /Added to this daily-care draft/);
assert.doesNotMatch(dailyCapture, /Unverified extraction/);
assert.doesNotMatch(dailyCapture, /Not returned by the extractor/);
assert.doesNotMatch(landingStyles, /Strong, high-contrast calls to action/);
assert.doesNotMatch(landingStyles, /box-shadow: 0 3px 0 rgba\(23, 63, 75, 0\.18\)/);
assert.doesNotMatch(notifications, /Backend-backed notifications/);
assert.match(assistPanel, /background: "#ffffff", color: "#172b35"/);
assert.match(assistPanel, /background: loading \|\| !question\.trim\(\) \? "#e8eee9" : "#b9d5b5"/);
assert.match(assistPanel, /setQuestion\(event\.target\.value\); setError\(null\)/);
assert.match(assistPanel, /background: "#fff4dc"/);
assert.match(qwenPanel, /background: "#ffffff", color: "#172b35"/);
assert.match(qwenPanel, /background: loading \|\| !question\.trim\(\) \? "#e8eee9" : "#b9d5b5"/);
assert.match(qwenPanel, /setError\(null\)/);
assert.doesNotMatch(qwenPanel, /Context used:/);

console.log("Caregiver UI contract checks passed.");
