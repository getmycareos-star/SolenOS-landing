import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const source = await readFile("src/components/workflows/AICompanion.tsx", "utf8");
  assert.match(source, /pendingTurn\s*=\s*useRef/);
  assert.match(source, /restoreSavedConversation/);
  assert.match(source, /companionSessionStorageKey/);
  assert.match(source, /getJSON\(\`\/conversation\//);
  assert.match(source, /historyRestored/);
  assert.match(source, /Your saved conversation could not be restored/);
  assert.match(source, /pendingTurn\.current\?\.text\s*===\s*submittedText/);
  assert.match(source, /client_turn_id:\s*turnId/);
  assert.match(source, /if\s*\(pendingTurn\.current\?\.id\s*===\s*turnId\)\s*pendingTurn\.current\s*=\s*null/);
  assert.match(source, /pendingTurn\.current\s*=\s*null/);
  const catchBlock = source.match(/\}\s*catch\s*\{([\s\S]*?)\}\s*finally\s*\{/);
  assert.ok(catchBlock, "send failure handler should remain explicit");
  assert.doesNotMatch(catchBlock[1], /pendingTurn\.current\s*=\s*null/, "ambiguous failure must retain its retry key");
  assert.match(source, /setMessages\(prev => prev\.filter\(message => message !== userMsg\)\)/);
  console.log("Companion idempotency contract passed: stable key for same-text retry, new key for changed text, key cleared only after success or new session.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
