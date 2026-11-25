import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const workspace = read("src/lib/workspace-context.tsx");
const client = read("src/api/client.ts");

assert.match(workspace, /import \{[^}]*ensureAnonymousSession[^}]*getJSON[^}]*\} from "@\/api\/client";/,
  "workspace bootstrap must use the shared authenticated API client");
assert.ok(workspace.includes("return getJSON("), "care-record bootstrap must use getJSON");
assert.ok(workspace.includes("`/situation?care_session_id=${encodeURIComponent(sid)}&offer_return_invite=0`"),
  "bootstrap must retain the session-scoped situation read and disabled return invitation");
assert.doesNotMatch(workspace, /fetch\(\s*`\/api\/situation/,
  "workspace bootstrap must not bypass the shared request reliability policy");
assert.match(client, /async function authorizedRead[\s\S]*?fetchGetWithRetry/);
assert.match(client, /export async function getJSON\(path: string\)[\s\S]*?authorizedRead\(path\)/);
assert.match(client, /const API_REQUEST_TIMEOUT_MS = 15_000/);
assert.match(client, /const RETRYABLE_GET_STATUSES = new Set\(\[502, 503, 504\]\)/);
assert.match(workspace, /setRecordLoadError\([\s\S]*?setEntryReady\(true\)/,
  "a failed bootstrap read must leave the workspace in an explicit recoverable state");
const bootstrapFailure = workspace.slice(workspace.lastIndexOf('.catch(() => {'));
assert.match(bootstrapFailure, /setRecordLoadError\(/, "failed hydration must be shown as an explicit record-load failure");
assert.match(bootstrapFailure, /setEntryReady\(true\)/, "failed hydration must allow the recoverable workspace shell to render");
assert.doesNotMatch(bootstrapFailure, /router\.replace\("\/start"\)/, "a failed record read must never be redirected into the first-visit route");

console.log("PASS: workspace bootstrap uses authenticated, bounded, safe-retry GET infrastructure");
