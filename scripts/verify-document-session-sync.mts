import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/app/workspace/documents/page.tsx", import.meta.url), "utf8");
const syncEffectStart = source.indexOf("let syncSequence = 0;");
const syncEffectEnd = source.indexOf("}, [loadDocuments]);", syncEffectStart);
assert.ok(syncEffectStart >= 0 && syncEffectEnd > syncEffectStart, "document durable-sync effect must be present");
const effect = source.slice(syncEffectStart, syncEffectEnd);

assert.match(effect, /const requestSequence = \+\+syncSequence/, "each sync attempt must receive a monotonically increasing request identity");
assert.match(effect, /requestSequence === syncSequence/, "older overlapping sync attempts must be fenced out");
assert.match(effect, /personId === getPersonId\(\)/, "sync results must still belong to the active care recipient");
assert.match(effect, /caregiverId === getCaregiverId\(\)/, "sync results must still belong to the active caregiver");
assert.match(effect, /if \(!isCurrent\(\)\) return;[\s\S]*?setPendingUploads\(summary\.pending\)/, "initial queue counts must be guarded by the active session");
assert.match(effect, /await syncDurableWrites\([\s\S]*?if \(!isCurrent\(\)\) return;[\s\S]*?getDurableWriteSummary\(personId, caregiverId\)/, "a stale upload sync must not refresh another session's queue state");
assert.match(effect, /await loadDocuments\(true\);\s*if \(!isCurrent\(\)\) return;/, "stale sync completions must not dispatch care-record refresh events");
assert.match(effect, /syncSequence \+= 1/, "unmount must invalidate in-flight sync attempts");

const loadStart = source.indexOf("const loadDocuments");
const loadEnd = source.indexOf("}, []);", loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, "document list loader must be present");
const loader = source.slice(loadStart, loadEnd);
assert.match(loader, /const requestSequence = \+\+documentLoadSequenceRef\.current/, "each document list read must have a request identity");
assert.match(loader, /documentLoadSequenceRef\.current === requestSequence/, "older document reads must not replace newer results");
assert.match(loader, /if \(isCurrentRequest\(\)\) setDocuments\(next\)/, "only the newest successful document read may replace the list");
assert.match(loader, /cause instanceof ApiResponseError[\s\S]*?cause\.status === 401[\s\S]*?cause\.status === 403/, "authentication and access denial must be distinguished from transient read failures");
assert.match(loader, /if \(!requestPersonId \|\| !requestCaregiverId \|\| accessDenied\)[\s\S]*?setDocuments\(\[\]\)/, "denied document access must clear previously loaded private document data");

console.log("✓ document reads and offline-sync results are fenced by request identity and caregiver session");
