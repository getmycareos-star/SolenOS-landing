/**
 * Caregiver product-path gate — Living Care Record integrity before internal preview.
 * Path A only. Do not weaken scripts — fix implementation when red.
 * SoT: docs/13-infrastructure/preview-qualification.md · docs/02-product/solenos-product-integrity.md
 */
import "./_verify-env.mts";
import { execSync } from "node:child_process";

const root = process.cwd();

const SCRIPTS = [
  "verify:memory-correction",
  "verify:input-entry-contract",
  "verify:single-user-journey",
  "verify:continuity-core-tier1",
  "verify:living-care-record-regression",
  "verify:care-reality-extraction",
  "verify:care-reality-behavior",
  "verify:care-signal-understanding",
  "verify:generalized-care-understanding",
  "verify:response-contract",
  "verify:done-for-now-continuity",
  "verify:return-continuity",
  "verify:caregiver-response-composer",
  "verify:active-care-situation",
  "verify:phase5-entry-gate",
  // Integrity / Response Intelligence (deploy SoT — architecture + understanding)
  "verify:response-intelligence-upgrade",
  "verify:living-care-record-ux",
  "verify:golden-dementia-baseline",
  "verify:uncertainty-preservation",
  "verify:visual-language",
  "verify:trust-consent",
  // Caregiver promise — midnight test, hard rejection, MVP response + learning (do not weaken)
  "verify:caregiver-understanding-test",
  "verify:intelligence-validation",
  "verify:caregiver-understanding-output",
  "verify:mvp-response-behavior",
  "verify:learning-first-release",
  "verify:mvp-faq",
  "verify:nav-journey",
  // Today's paste / restart failures — green = caregiver behavior, not phrase-ban theater
  "verify:initial-care-reality-assessment",
  "verify:care-reality-language",
  "verify:output-quality",
  "verify:caregiver-paste-behavior",
"verify:care-situation-understanding",
  "verify:understanding-validation",
] as const;

console.log("=== SolenOS caregiver product-path (Path A integrity) ===\n");

for (const script of SCRIPTS) {
  console.log(`>>> npm run ${script}\n`);
  execSync(`npm run ${script}`, { stdio: "inherit", cwd: root });
  console.log("");
}

console.log("verify:product-path OK");
