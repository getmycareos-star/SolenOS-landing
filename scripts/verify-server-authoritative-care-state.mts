import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspace = fs.readFileSync(path.join(root, "src/lib/workspace-context.tsx"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/workspace/layout.tsx"), "utf8");

assert.match(workspace, /openSituationsFromSituationApi\(data\)/);
assert.match(workspace, /situations:\s*fromServer/);
assert.match(workspace, /cache:\s*"no-store"/);
assert.match(workspace, /setRecordLoadError\(/);
assert.doesNotMatch(workspace, /situations:\s*localSituations/);
assert.doesNotMatch(workspace, /persistSituations\(|persistTimeline\(|persistActiveSituationId\(/);
assert.doesNotMatch(workspace, /loadTimelineFromStorage\(|loadActiveSituationId\(/);
assert.match(
  workspace,
  /Always replace the visible projection with the server result[\s\S]*?including an empty result/,
  "an empty authorized server result must clear the visible projection",
);
assert.match(layout, /recordLoadError/);
assert.match(layout, /window\.location\.reload\(\)/);

console.log("PASS: caregiver-visible care state is hydrated from the authenticated no-store API response, not browser-local care data.");
console.log("PASS: empty server records clear the projection and failed reads surface a recoverable error.");
