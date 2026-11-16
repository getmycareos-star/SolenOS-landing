import assert from "node:assert/strict";
import fs from "node:fs";

const router = fs.readFileSync("src/components/mvp-workspace/FirstVisitWorkspaceRouter.tsx", "utf8");
const page = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const capture = fs.readFileSync("src/components/mvp-workspace/AddSituationPanel.tsx", "utf8");
const workspace = fs.readFileSync("src/components/mvp-workspace/CognitiveWorkspace.tsx", "utf8");

assert.match(page, /FirstVisitWorkspaceRouter/);
assert.match(router, /ensureAnonymousSession/);
assert.match(router, /api\/situation\?care_session_id=/);
assert.match(router, /data\.has_context_root/);
assert.match(router, /suppress_first_time_ux/);
assert.match(router, /\(data\.total_events \?\? 0\) > 0/);
assert.match(router, /setState\(hasSavedCare \? "returning" : "first_visit"\)/);
assert.match(router, /setState\("unavailable"\)/);
assert.match(router, /We won’t treat an unavailable record as a new one/);
assert.match(router, /<CognitiveWorkspace \/>/);
assert.match(router, /Your care journey starts here/);
assert.match(router, /solenos-first-visit-mode/);
assert.match(capture, /What’s been happening\?/);
assert.match(workspace, /Start with one thing you want to remember/);
assert.match(capture, /Add to my care record/);
assert.match(capture, /rows=\{isFirstCapture \? 3 : 6\}/);
assert.ok(
  capture.indexOf('<textarea\n          className="brain-dump composer-textarea"') <
    capture.indexOf('<div className="composer-toolbar"'),
  "first-time caregivers should see the input before capture actions",
);

console.log("First-visit capture and fail-closed return-routing checks passed.");
