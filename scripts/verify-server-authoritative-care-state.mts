import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspace = fs.readFileSync(path.join(root, "src/lib/workspace-context.tsx"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/workspace/layout.tsx"), "utf8");
const runtimeExports = fs.readFileSync(path.join(root, "src/lib/ui-runtime/index.ts"), "utf8");
const situationStore = fs.readFileSync(path.join(root, "src/lib/ui-runtime/situation-store.ts"), "utf8");
const timelineStore = fs.readFileSync(path.join(root, "src/lib/ui-runtime/timeline-store.ts"), "utf8");
const legacyFilesystemStore = fs.readFileSync(path.join(root, "src/lib/living-care-record-persistence/fs-store.ts"), "utf8");
const retiredAnalyzeRoute = fs.readFileSync(path.join(root, "src/app/api/analyze/route.ts"), "utf8");
const companion = fs.readFileSync(path.join(root, "src/components/workflows/AICompanion.tsx"), "utf8");
const communityClient = fs.readFileSync(path.join(root, "src/app/workspace/community/CommunityClient.tsx"), "utf8");
const activeIdentityClients = [
  "src/lib/workspace-context.tsx",
  "src/components/app-shell/AppShell.tsx",
  "src/components/mvp-workspace/FirstVisitWorkspaceRouter.tsx",
  "src/components/mvp-workspace/CognitiveWorkspace.tsx",
].map((file) => ({
  file,
  source: fs.readFileSync(path.join(root, file), "utf8"),
}));

assert.match(workspace, /openSituationsFromSituationApi\(data\)/);
for (const { file, source } of activeIdentityClients) {
  assert.match(source, /from ["']@\/lib\/care-identity\/durable-care-key["']/, `${file} must import only browser-safe identity helpers`);
  assert.doesNotMatch(source, /from ["']@\/lib\/care-identity["']/, `${file} must not pull the legacy filesystem-backed identity barrel into the browser`);
}
assert.match(workspace, /situations:\s*fromServer/);
assert.match(workspace, /cache:\s*"no-store"/);
assert.match(workspace, /setRecordLoadError\(/);
assert.doesNotMatch(workspace, /situations:\s*localSituations/);
assert.doesNotMatch(workspace, /persistSituations\(|persistTimeline\(|persistActiveSituationId\(/);
assert.doesNotMatch(workspace, /loadTimelineFromStorage\(|loadActiveSituationId\(/);
assert.doesNotMatch(workspace, /loadSituationsFromStorage\(|localSituations/);
assert.doesNotMatch(runtimeExports, /loadSituationsFromStorage|persistSituations|loadActiveSituationId|persistActiveSituationId|loadTimelineFromStorage|persistTimeline/);
assert.doesNotMatch(situationStore, /localStorage/);
assert.doesNotMatch(timelineStore, /localStorage/);
assert.match(legacyFilesystemStore, /process\.env\.NODE_ENV === "production"/);
assert.match(legacyFilesystemStore, /Legacy filesystem persistence is disabled in production/);
assert.match(retiredAnalyzeRoute, /export async function POST\(_request: Request\)/);
assert.match(retiredAnalyzeRoute, /This older analysis route is no longer available/);
assert.match(retiredAnalyzeRoute, /status: 410/);
assert.doesNotMatch(retiredAnalyzeRoute, /analyzePipelineDisabledResponse|isAnalyzePipelineEnabled|runAnalyzePipeline/);
assert.match(
  workspace,
  /Always replace the visible projection with the server result[\s\S]*?including an empty result/,
  "an empty authorized server result must clear the visible projection",
);
assert.match(layout, /recordLoadError/);
assert.match(layout, /window\.location\.reload\(\)/);
assert.match(companion, /getJSON\('\/conversations\?limit=1'\)/);
assert.match(companion, /listing\.person_id !== session\.person\.id/);
assert.match(companion, /latest\\.session_id/);
assert.match(
  companion,
  /if \(response\.session_id\) \{[\\s\\S]*?try \{[\\s\\S]*?window\.localStorage\.setItem\([\\s\\S]*?\)\s*\} catch \{[\\s\\S]*?Server-backed conversation listing restores history without this pointer\./,
  "a failed optional browser pointer write must not discard a successfully saved Companion reply",
);
assert.match(communityClient, /FEATURE_FLAGS\.community/);
assert.match(communityClient, /Community is not available yet/);

console.log("PASS: caregiver-visible care state is hydrated from the authenticated no-store API response, not browser-local care data.");
console.log("PASS: empty server records clear the projection and failed reads surface a recoverable error.");
