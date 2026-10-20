import fs from "node:fs";
import path from "node:path";
import {
  CAREGIVER_FIRST_STRATEGIC_BET,
  CAREGIVER_FIRST_ONE_LINE_TRUTH,
  CAREGIVER_FIRST_EXPERIENCE_RULE,
  CAREGIVER_FIRST_FREE_TIER_TRUTH,
  CAREGIVER_FIRST_CLARITY_PRINCIPLE,
  CAREGIVER_FIRST_IMPLEMENTATION_FILTER_QUESTION,
  CAREGIVER_FIRST_FORBIDDEN_DRIFT,
  CAREGIVER_FIRST_NEVER_BECOME,
  CAREGIVER_FIRST_SUCCESS_SIGNALS,
  CAREGIVER_FIRST_FAILURE_MODEL,
  passesCaregiverFirstFilter,
} from "../src/lib/caregiver-first-positioning";
import { CANONICAL_CAREGIVER_FIRST_TRUTH } from "../src/lib/canonical-architecture";
import { MEDICAL_BOUNDARY_CAREGIVER_FIRST_ALIGNMENT } from "../src/lib/medical-responsibility-boundary/constants";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";

console.log("=== Caregiver-First Positioning Contract ===\n");

if (!CAREGIVER_FIRST_STRATEGIC_BET.includes("caregivers first")) {
  throw new Error("strategic bet drift");
}
if (!CAREGIVER_FIRST_ONE_LINE_TRUTH.includes("mental effort")) {
  throw new Error("one-line truth drift");
}
if (!CAREGIVER_FIRST_EXPERIENCE_RULE.includes("Value before payment")) {
  throw new Error("first experience rule drift");
}
if (!CAREGIVER_FIRST_FREE_TIER_TRUTH.includes("prove relief first")) {
  throw new Error("free tier truth drift");
}
if (!CAREGIVER_FIRST_CLARITY_PRINCIPLE.includes("Clarity over authority")) {
  throw new Error("clarity principle drift");
}
if (!CAREGIVER_FIRST_IMPLEMENTATION_FILTER_QUESTION.includes("cognitive burden")) {
  throw new Error("implementation filter drift");
}
if (CAREGIVER_FIRST_FORBIDDEN_DRIFT.length < 6) {
  throw new Error("forbidden drift list incomplete");
}
if (CAREGIVER_FIRST_NEVER_BECOME.length < 5) {
  throw new Error("never-become boundary list incomplete");
}
if (CAREGIVER_FIRST_SUCCESS_SIGNALS.length < 4) {
  throw new Error("success signals drift");
}
console.log("✓ caregiver-first contract constants");

if (!CANONICAL_CAREGIVER_FIRST_TRUTH.includes("caregivers first")) {
  throw new Error("canonical caregiver-first truth drift");
}
console.log("✓ canonical architecture aligned");

if (!MEDICAL_BOUNDARY_CAREGIVER_FIRST_ALIGNMENT.includes("caregiver-first")) {
  throw new Error("medical boundary caregiver-first alignment drift");
}
console.log("✓ medical boundary aligned with caregiver-first");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing marker: ${marker}`);
  }
}
console.log("✓ caregiver-first system prompt markers");

if (
  !passesCaregiverFirstFilter({ reducesCognitiveBurden: true }) ||
  passesCaregiverFirstFilter({ reducesCognitiveBurden: false }) ||
  passesCaregiverFirstFilter({ reducesCognitiveBurden: true, requiresAccountBeforeValue: true })
) {
  throw new Error("feature filter gate drift");
}
console.log("✓ feature filter gate");

const pageSource = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf-8");

if (!pageSource.includes("InputBox") || !pageSource.includes("handleAnalyze")) {
  throw new Error("page must expose input and analyze without prerequisite flows");
}

const authGatePatterns = [
  "signup",
  "signIn",
  "sign-in",
  "login",
  "onboarding",
  "tutorial",
  "product tour",
  "requireAuth",
  "isAuthenticated",
  "mustSignUp",
];
for (const pattern of authGatePatterns) {
  if (pageSource.toLowerCase().includes(pattern.toLowerCase())) {
    throw new Error(`page contains auth/onboarding gate before value: ${pattern}`);
  }
}

const blockingSurfacePatterns = ["dashboard", "workflow", "care coordination", "task manager"];
for (const pattern of blockingSurfacePatterns) {
  if (pageSource.toLowerCase().includes(pattern.toLowerCase())) {
    throw new Error(`page contains forbidden blocking surface: ${pattern}`);
  }
}

if (pageSource.includes("output && telemetryUserId && interactionId")) {
  throw new Error("output must not be gated on telemetry/account before first relief");
}
if (!pageSource.includes("{output && (")) {
  throw new Error("output must render immediately after successful analyze");
}
console.log("✓ first experience: analyze without auth gate, value before account");

for (const forbidden of CAREGIVER_FIRST_FORBIDDEN_DRIFT) {
  if (!CAREGIVER_FIRST_FAILURE_MODEL.toLowerCase().includes(forbidden.split(" ")[0].toLowerCase())) {
    // failure model references drift categories; contract documents all forbidden drift strings
    if (!fs.readFileSync(
      path.join(process.cwd(), "src/lib/caregiver-first-positioning/contract-constants.ts"),
      "utf-8",
    ).includes(forbidden)) {
      throw new Error(`forbidden drift not documented: ${forbidden}`);
    }
  }
}
console.log("✓ forbidden product drift documented in contract");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
if (!pipelineSource.includes("enforceMedicalBoundary")) {
  throw new Error("analyze pipeline must wire medical boundary gate");
}
console.log("✓ medical boundary still wired in pipeline");

console.log(`\n✓ ${CAREGIVER_FIRST_FAILURE_MODEL}`);
console.log(`✓ ${CAREGIVER_FIRST_ONE_LINE_TRUTH}`);
