import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/workflows/AICompanion.tsx", "utf8");

// Contract checks for the retry boundary. Backend integration tests cover the
// actual idempotent replay semantics; these assertions prevent the UI from
// accidentally dropping the key or reusing it for changed message text.
assert.match(source, /pendingTurnRef = useRef<\{ text: string; id: string \} \| null>/);
assert.match(source, /pending\?\.text === submittedText\s*\? pending\.id\s*:\s*crypto\.randomUUID\(\)/);
assert.match(source, /pendingTurnRef\.current = \{ text: submittedText, id: clientTurnId \}/);
assert.match(source, /client_turn_id: clientTurnId/);
assert.match(source, /if \(pendingTurnRef\.current\?\.id === clientTurnId\) pendingTurnRef\.current = null/);

const requestStart = source.indexOf("const response = await postJSON('/conversation/message'");
const responseValidation = source.indexOf("if (typeof response?.reply !== 'string' || !response.reply.trim())", requestStart);
const clearKey = source.indexOf("pendingTurnRef.current = null", requestStart);
assert.ok(requestStart >= 0 && responseValidation > requestStart && clearKey > responseValidation,
  "the pending idempotency key must only be cleared after a valid response");

const catchStart = source.indexOf("    } catch {", clearKey);
const catchEnd = source.indexOf("    } finally {", catchStart);
assert.ok(catchStart > clearKey && catchEnd > catchStart);
assert.ok(!source.slice(catchStart, catchEnd).includes("pendingTurnRef.current = null"),
  "failed/ambiguous requests must retain the key for retry");

console.log("Companion idempotent-retry UI contract checks passed.");
