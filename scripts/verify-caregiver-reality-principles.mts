import fs from "node:fs";
import path from "node:path";
import {
  CAREGIVER_REALITY_PRINCIPLES,
  CAREGIVER_REALITY_INTERPRETATION_RULE,
  CAREGIVER_REALITY_FORBIDDEN_POSITIONING,
  CAREGIVER_REALITY_REJECTION_CRITERIA,
  CAREGIVER_REALITY_ACCEPTANCE_CRITERIA,
  CAREGIVER_REALITY_ONE_LINE_TRUTH,
  CAREGIVER_REALITY_FAILURE_MODEL,
  CAREGIVER_REALITY_CAREGIVER_FIRST_LINK,
  passesCaregiverRealityFilter,
  copyPassesCaregiverRealityFilter,
  matchesForbiddenCopyPattern,
  findForbiddenCopyViolations,
  FORBIDDEN_COPY_PHRASES,
} from "../src/lib/caregiver-reality-principles";
import { CAREGIVER_FIRST_IMPLEMENTATION_FILTER_QUESTION } from "../src/lib/caregiver-first-positioning";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { resolvePreStructureGroundingLine } from "../src/lib/caregiver-pressure-reduction";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Caregiver Reality Principles Contract ===\n");

if (CAREGIVER_REALITY_PRINCIPLES.length !== 6) {
  throw new Error("must define exactly 6 caregiver reality principles");
}
for (const principle of CAREGIVER_REALITY_PRINCIPLES) {
  if (!principle.id || !principle.title || !principle.oneLineTruth) {
    throw new Error(`principle incomplete: ${principle.id ?? "unknown"}`);
  }
}
console.log("✓ six caregiver reality principles defined");

if (!CAREGIVER_REALITY_INTERPRETATION_RULE.ask.includes("carry less")) {
  throw new Error("interpretation rule ask drift");
}
if (!CAREGIVER_REALITY_INTERPRETATION_RULE.doNotAsk.includes("manage more")) {
  throw new Error("interpretation rule doNotAsk drift");
}
console.log("✓ interpretation rule: carry less, not manage more");

if (CAREGIVER_REALITY_FORBIDDEN_POSITIONING.length < 5) {
  throw new Error("forbidden positioning list incomplete");
}
if (CAREGIVER_REALITY_REJECTION_CRITERIA.length < 5) {
  throw new Error("rejection criteria incomplete");
}
if (CAREGIVER_REALITY_ACCEPTANCE_CRITERIA.length < 4) {
  throw new Error("acceptance criteria incomplete");
}
console.log("✓ rejection and acceptance criteria");

if (!CAREGIVER_REALITY_ONE_LINE_TRUTH.includes("losing yourself")) {
  throw new Error("one-line truth drift");
}
if (!CAREGIVER_REALITY_FAILURE_MODEL.includes("remember")) {
  throw new Error("failure model drift");
}
console.log("✓ one-line truth and failure model");

if (!CAREGIVER_REALITY_CAREGIVER_FIRST_LINK.includes("caregiver-first-positioning")) {
  throw new Error("caregiver-first link missing");
}
if (
  CAREGIVER_REALITY_CAREGIVER_FIRST_LINK.includes(CAREGIVER_FIRST_IMPLEMENTATION_FILTER_QUESTION)
) {
  throw new Error("caregiver-first link must not duplicate implementation filter text");
}
console.log("✓ links to caregiver-first without duplication");

if (
  !passesCaregiverRealityFilter({ reducesBurden: true }) ||
  passesCaregiverRealityFilter({ increasesResponsibility: true }) ||
  passesCaregiverRealityFilter({ increasesMonitoring: true }) ||
  passesCaregiverRealityFilter({})
) {
  throw new Error("design filter gate drift");
}
console.log("✓ design filter rejects manage-more burden patterns");

const manageMoreSamples = [
  "Remember to track everything in your care plan.",
  "Stay organized and manage your tasks daily.",
  "Use this to manage more effectively.",
];
for (const sample of manageMoreSamples) {
  if (copyPassesCaregiverRealityFilter(sample)) {
    throw new Error(`forbidden copy must fail filter: ${sample}`);
  }
  if (!matchesForbiddenCopyPattern(sample)) {
    throw new Error(`forbidden pattern must match: ${sample}`);
  }
}
if (!copyPassesCaregiverRealityFilter("What matters now is the missed evening dose.")) {
  throw new Error("neutral clinical copy must pass filter");
}
console.log("✓ forbidden copy patterns detect violations");

for (const phrase of FORBIDDEN_COPY_PHRASES) {
  const violations = findForbiddenCopyViolations(`Please ${phrase} today.`);
  if (violations.length === 0) {
    throw new Error(`findForbiddenCopyViolations must detect: ${phrase}`);
  }
}
console.log("✓ forbidden phrase list complete");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
console.log("✓ caregiver reality system prompt markers");

const pageSource = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf-8");
const inputBoxSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/InputBox.tsx"),
  "utf-8",
);
const outputRendererSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/OutputRenderer.tsx"),
  "utf-8",
);
const visibleCopy = pageSource + inputBoxSource + outputRendererSource;

const visibleForbidden = ["manage more", "remember more", "stay organized", "track everything"];
for (const phrase of visibleForbidden) {
  if (visibleCopy.toLowerCase().includes(phrase.toLowerCase())) {
    throw new Error(`visible UI copy contains forbidden phrase: ${phrase}`);
  }
}
if (!pageSource.includes("Less to carry")) {
  throw new Error("page tagline must reinforce carry-less framing");
}
if (!outputRendererSource.includes("What is happening")) {
  throw new Error("output field labels must remain neutral");
}
console.log("✓ UI visible copy passes reality principles audit");

const semanticSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/semantic-role-isolation/contract-constants.ts"),
  "utf-8",
);
if (!semanticSource.includes("Caregiver Reality Principle 5")) {
  throw new Error("semantic role contract must link what_matters_now / what_can_wait to Principle 5");
}
console.log("✓ semantic role contract linked to uncertainty reduction");

const groundingLine = resolvePreStructureGroundingLine(VERIFY_VALID_SOLENOS);
if (!groundingLine || !groundingLine.includes("invisible")) {
  throw new Error("pre-structure grounding must align with invisible responsibility (Principle 3)");
}
console.log("✓ pre-structure grounding aligned with Principle 3");

console.log(`\n✓ ${CAREGIVER_REALITY_FAILURE_MODEL}`);
console.log(`✓ ${CAREGIVER_REALITY_ONE_LINE_TRUTH}`);
