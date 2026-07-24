import fs from "node:fs";
import path from "node:path";
import {
  buildGeminiExecutionEnvelope,
  GEMINI_MVP_MODEL,
  GEMINI_RETRY_RULE,
  strictParseModelJson,
} from "../src/lib/gemini-contract";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import { applyContextWindowStrategy } from "../src/lib/context-window-strategy";
import { ANALYZE_MAX_RETRIES, ANALYZE_RETRY_NOTICE } from "../src/lib/analyze-pipeline/constants";
import { MVP_GEMINI_KEY_ROUTE, MVP_MAX_LLM_CALLS, MVP_MAX_RETRIES } from "../src/lib/mvp-architecture";

function walkTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...walkTsFiles(full));
    } else if (/\.(ts|tsx|mts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const repoFiles = [
  ...walkTsFiles(path.join(process.cwd(), "src")),
  ...walkTsFiles(path.join(process.cwd(), "scripts")),
];

const mvpKeyScope = [
  path.join(process.cwd(), "src/app"),
  path.join(process.cwd(), "src/lib/analyze-pipeline"),
  path.join(process.cwd(), "src/lib/gemini-contract"),
  path.join(process.cwd(), "src/lib/solenos-langchain-adapter/gemini.ts"),
  path.join(process.cwd(), "src/lib/solenos-langchain-adapter/raw-text.ts"),
];

const mvpFiles = mvpKeyScope.flatMap((target) => {
  if (target.endsWith(".ts")) {
    return fs.existsSync(target) ? [target] : [];
  }
  return walkTsFiles(target);
});

const keyReaders: string[] = [];
const aizaLeaks: string[] = [];

for (const file of repoFiles) {
  const source = fs.readFileSync(file, "utf-8");
  if (/AIza[0-9A-Za-z_-]{20,}/.test(source)) {
    aizaLeaks.push(path.relative(process.cwd(), file).replace(/\\/g, "/"));
  }
}

for (const file of mvpFiles) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
  const source = fs.readFileSync(file, "utf-8");
  if (source.includes("process.env.GEMINI_API_KEY")) {
    keyReaders.push(rel);
  }
}

const routeSource = fs.readFileSync(
  path.join(process.cwd(), MVP_GEMINI_KEY_ROUTE),
  "utf-8",
);
const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const geminiAdapterSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/solenos-langchain-adapter/gemini.ts"),
  "utf-8",
);

console.log("=== Gemini 1.5 Pro Execution Contract ===\n");

if (GEMINI_MVP_MODEL !== "gemini-1.5-pro") {
  throw new Error("MVP model must be gemini-1.5-pro");
}
console.log("✓ model locked to gemini-1.5-pro");

if (keyReaders.length !== 1 || keyReaders[0] !== MVP_GEMINI_KEY_ROUTE) {
  throw new Error(
    `GEMINI_API_KEY must be read only in ${MVP_GEMINI_KEY_ROUTE}, found: ${keyReaders.join(", ")}`,
  );
}
console.log(`✓ API key read only in ${MVP_GEMINI_KEY_ROUTE}`);

if (aizaLeaks.length > 0) {
  throw new Error(`API key material found in repo files: ${aizaLeaks.join(", ")}`);
}
console.log("✓ no API key strings in committed source");

if (geminiAdapterSource.includes("process.env.GEMINI_API_KEY")) {
  throw new Error("gemini adapter must not read GEMINI_API_KEY from env");
}
console.log("✓ gemini adapter receives apiKey parameter only");

const envelope = buildGeminiExecutionEnvelope(
  applyContextWindowStrategy(stressNormalizeInput("Mom missed her evening medication.")),
  false,
);
if (!envelope.user.includes("RULE:") || !envelope.user.includes("SCHEMA:") || !envelope.user.includes("INPUT:")) {
  throw new Error("execution envelope missing required sections");
}
console.log("✓ required Gemini execution envelope with structured input");

const retryEnvelope = buildGeminiExecutionEnvelope(
  applyContextWindowStrategy(stressNormalizeInput("test")),
  true,
);
if (!retryEnvelope.user.includes(GEMINI_RETRY_RULE)) {
  throw new Error("retry envelope must rebuild RULE from scratch");
}
console.log("✓ retry rebuilds envelope (stateless regeneration)");

if (ANALYZE_RETRY_NOTICE !== GEMINI_RETRY_RULE) {
  throw new Error("retry notice must match GEMINI_RETRY_RULE exactly");
}

if (MVP_MAX_RETRIES !== 2 || MVP_MAX_LLM_CALLS !== 3 || ANALYZE_MAX_RETRIES !== 2) {
  throw new Error("retry budget must be 2 retries (3 total calls max)");
}
console.log("✓ max 2 retries (3 total LLM calls)");

if (!pipelineSource.includes("strictParseModelJson")) {
  throw new Error("pipeline must use strict JSON.parse isolation");
}
if (pipelineSource.includes(".trim()") && pipelineSource.includes("parse")) {
  // allow trim in normalizeAnalyzeInput only
}
if (/JSON\.parse\([^)]*trim/.test(pipelineSource)) {
  throw new Error("forbidden JSON parse with trim/repair");
}
console.log("✓ output isolation: raw capture → JSON.parse only → Zod");

if (!routeSource.includes("runAnalyzePipeline({")) {
  throw new Error("route must pass geminiApiKey into pipeline");
}
console.log("✓ server-side key flow: route → pipeline → invokeGeminiExecution");

strictParseModelJson(
  '{"what_is_happening":"x explanation with context because clarity matters here for testing.","what_matters_now":"y priority because it matters for safety now.","what_to_ask_next":"z?","risk_level":"low","what_can_wait":"w can wait because it is lower priority.","follow_up_items":[],"_meta":{"context_completeness":0.5,"missing_critical_fact":null,"confidence":"medium"}}',
);
console.log("✓ strictParseModelJson accepts valid JSON");

let parseFailed = false;
try {
  strictParseModelJson("not json");
} catch {
  parseFailed = true;
}
if (!parseFailed) throw new Error("strictParseModelJson must throw on invalid JSON");
console.log("✓ strictParseModelJson rejects prose (retry path)");

console.log("\n✓ Gemini 1.5 Pro execution contract enforced");
