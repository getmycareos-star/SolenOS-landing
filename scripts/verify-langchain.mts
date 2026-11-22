import fs from "node:fs";
import path from "node:path";
import {
  buildSolenOSPrompt,
  SOLENOS_SYSTEM_PROMPT,
  resolveSolenOSLLMProvider,
  runSolenOSLLM,
  SYSTEM_PROMPT_SPEC_MARKERS,
} from "../src/lib/solenos-langchain-adapter";

const adapterDir = path.join(process.cwd(), "src/lib/solenos-langchain-adapter");
const adapterSource = fs
  .readdirSync(adapterDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => fs.readFileSync(path.join(adapterDir, f), "utf-8"))
  .join("\n");

const forbiddenPatterns = [
  /\\bAgentExecutor\\b/,
  /\\bcreateReactAgent\\b/,
  /\\bRunnableSequence\\b/,
  /\\bConversationChain\\b/,
  /\\bBufferMemory\\b/,
  /\\bChatMessageHistory\\b/,
  /\\bbindTools\\b/,
  /\\bcreateToolCallingAgent\\b/,
  /from\\s+["']@\\/lib\\/(store|process|response-validator)/,
  /from\\s+["']\\.\\.\\/(store|process|response-validator)/,
  /ChatGoogleGenerativeAI/,
  /OPENAI_API_KEY/,
  /GEMINI_API_KEY/,
  /gpt-4o/,
];

console.log("=== solenos-langchain-adapter — QWEN-ONLY EXECUTION SPEC ===\\n");

const input = "Mom missed her evening medication.";
const context = { session_id: "ses_test", turn: 2 };

const promptA = buildSolenOSPrompt(input, context);
const promptB = buildSolenOSPrompt(input, context);
if (promptA !== promptB) throw new Error("prompt builder is not deterministic");
console.log("✓ deterministic prompt assembly");

if (!SOLENOS_SYSTEM_PROMPT.includes("what_is_happening")) {
  throw new Error("system prompt missing SolenOS schema fields");
}
for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing spec marker: ${marker}`);
  }
}
console.log("✓ SolenOS MVP system prompt includes schema, compression, and format rules");

for (const pattern of forbiddenPatterns) {
  if (pattern.test(adapterSource)) throw new Error(`forbidden provider/adapter pattern: ${pattern}`);
}
console.log("✓ no Gemini/OpenAI-hosted provider path in the adapter");

const provider = resolveSolenOSLLMProvider();
if (provider && provider !== "ollama") throw new Error(`unexpected provider: ${provider}`);
if (!provider) {
  let rejected = false;
  try { await runSolenOSLLM(input); } catch { rejected = true; }
  if (!rejected) throw new Error("expected error when Qwen is not configured (no silent fallback)");
  console.log("✓ rejects missing Qwen configuration; no provider fallback");
} else {
  console.log("✓ Qwen/Ollama provider resolved (live call skipped in verify)");
}

console.log("\nSample user prompt block:\n");
console.log(promptA.slice(0, 240) + "...");
console.log("\n✓ adapter is prompt + single-pass Qwen invoke only");
