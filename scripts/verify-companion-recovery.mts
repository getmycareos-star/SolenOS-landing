import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, "src/components/workflows/AICompanion.tsx"),
  "utf8",
);

const restoreStart = source.indexOf("const restoreConversation = async () =>");
const restoreEnd = source.indexOf("void restoreConversation()", restoreStart);
assert.ok(restoreStart >= 0 && restoreEnd > restoreStart, "conversation restoration effect must exist");
const restore = source.slice(restoreStart, restoreEnd);
const draftRead = restore.indexOf("window.sessionStorage.getItem(pendingKey)");
const sessionBootstrap = restore.indexOf("await ensureAnonymousSession()");
assert.ok(draftRead >= 0 && sessionBootstrap > draftRead,
  "pending draft must be restored before session bootstrap can fail");
assert.match(restore, /recoveredPendingDraft && isCurrentRestore\(\)[\s\S]*?The last message is still saved on this device|Your last message is still saved on this device/,
  "an expired session must leave a visible recovery message");
assert.match(restore, /pendingTurnId\.current = pending\.client_turn_id[\s\S]*?pendingTurnText\.current = pending\.text[\s\S]*?setInput\(pending\.text\)/,
  "recovery must retain the original idempotency key and exact caregiver text");

const sendStart = source.indexOf("const sendMessage = async");
const sendEnd = source.indexOf("const loadPendingCareUpdates", sendStart);
assert.ok(sendStart >= 0 && sendEnd > sendStart, "Companion send handler must exist");
const send = source.slice(sendStart, sendEnd);
const pendingWrite = send.indexOf("window.sessionStorage.setItem(");
const sendBootstrap = send.indexOf("await ensureAnonymousSession()");
assert.ok(pendingWrite >= 0 && sendBootstrap > pendingWrite,
  "outgoing drafts must be written before session bootstrap when recipient scope is cached");
assert.match(send, /client_turn_id: clientTurnId[\s\S]*?postJSON\('\/conversation\/message'/,
  "the same client turn ID must be sent to the server for idempotent reconciliation");
assert.match(send, /window\.sessionStorage\.removeItem\(pendingCompanionTurnStorageKey/,
  "a pending draft is cleared only after a successful persisted response");

console.log("Companion recovery contract passed: draft-before-bootstrap, pre-auth recovery, same idempotency key, and success-only cleanup.");
