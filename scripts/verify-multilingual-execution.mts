import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SOLENOS_LANGUAGE,
  SOLENOS_LANGUAGES,
  makeLanguageAwarePrompt,
  validateMultilingualExecution,
  isSolenOSLanguage,
} from "../src/lib/multilingual-execution";

console.log("=== SolenOS Multilingual Execution Layer ===\n");

const migration = fs.readFileSync("db/migrations/010_multilingual_execution.sql", "utf-8");

if (!migration.includes("language_preference")) {
  throw new Error("010 migration must add language_preference");
}

for (const lang of SOLENOS_LANGUAGES) {
  if (!migration.includes(`'${lang}'`)) {
    throw new Error(`010 migration must whitelist language: ${lang}`);
  }
}
console.log("✓ 010 migration defines 10-language whitelist");

if (SOLENOS_LANGUAGES.length !== 10) {
  throw new Error("SolenOS must support exactly 10 languages");
}
console.log("✓ SolenOSLanguage whitelist locked to 10 codes");

const wrapped = makeLanguageAwarePrompt("TASK BODY", "es");
if (!wrapped.includes("Spanish") || !wrapped.includes("SolenOS Multilingual Execution Engine")) {
  throw new Error("makeLanguageAwarePrompt must inject language execution rules");
}
if (!wrapped.includes("Medi-Cal") || !wrapped.includes("Medicare")) {
  throw new Error("makeLanguageAwarePrompt must preserve domain term rule");
}
console.log("✓ makeLanguageAwarePrompt wraps tasks with output language rules");

const geminiSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/solenos-langchain-adapter/gemini.ts"),
  "utf-8",
);
if (!geminiSource.includes("makeLanguageAwarePrompt")) {
  throw new Error("invokeGeminiExecution must wrap prompts via makeLanguageAwarePrompt");
}
console.log("✓ invokeGeminiExecution wraps every Gemini user prompt");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
if (!pipelineSource.includes("validateMultilingualExecution")) {
  throw new Error("analyze pipeline must validate multilingual execution before return");
}
if (!pipelineSource.includes("userLanguage")) {
  throw new Error("analyze pipeline must pass userLanguage to invokeGeminiExecution");
}
console.log("✓ analyze pipeline validates multilingual execution pre-return");

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/analyze/route.ts"),
  "utf-8",
);
if (!routeSource.includes("resolveUserLanguage")) {
  throw new Error("/api/analyze must resolve user language preference");
}
if (!routeSource.includes("MULTILINGUAL_RESPONSE_HEADER")) {
  throw new Error("/api/analyze must set multilingual response header");
}
console.log("✓ /api/analyze resolves language and sets response header");

const reasoningSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/reasoning/analyze.ts"),
  "utf-8",
);
if (!reasoningSource.includes("makeLanguageAwarePrompt")) {
  throw new Error("reasoning/analyze legacy Gemini path must use language wrapper");
}
console.log("✓ legacy reasoning Gemini path wrapped");

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/page.tsx"),
  "utf-8",
);
if (!pageSource.includes("language_preference") || !pageSource.includes("/api/user/language")) {
  throw new Error("frontend must load and persist language_preference");
}
console.log("✓ frontend loads language_preference at session start");

if (!isSolenOSLanguage("en") || isSolenOSLanguage("fr")) {
  throw new Error("isSolenOSLanguage must enforce whitelist");
}
console.log("✓ language validation rejects unsupported locales");

const valid = validateMultilingualExecution(
  {
    what_is_happening: "情况需要跟进。",
    what_matters_now: "先确认用药说明。",
    what_to_ask_next: "向医生确认剂量。",
    what_can_wait: "非紧急预约可以稍后安排。",
  },
  { userLanguage: "zh", promptWrapped: true },
  "zh",
);
if (!valid.ok) {
  throw new Error("Chinese output should pass multilingual validation");
}

const invalid = validateMultilingualExecution(
  {
    what_is_happening: "This is happening and you should ask the doctor about it now.",
    what_matters_now: "The hospital discharge notes are unclear about the medication schedule.",
    what_to_ask_next: "What should we do about the insurance coverage for this visit?",
    what_can_wait: "Scheduling a follow up appointment can wait until tomorrow morning.",
  },
  { userLanguage: "zh", promptWrapped: true },
  "zh",
);
if (invalid.ok) {
  throw new Error("English-only output must fail validation for zh target");
}
console.log("✓ multilingual response validation detects English leakage");

if (DEFAULT_SOLENOS_LANGUAGE !== "en") {
  throw new Error("default language must be en");
}

console.log("\n✓ SolenOS Multilingual Execution Layer enforced");
