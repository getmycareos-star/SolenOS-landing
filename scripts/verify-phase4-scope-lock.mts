/**
 * Phase 4 CI bundle — scope lock + golden map meta-verify + future capabilities.
 */
import { execSync } from "node:child_process";

const scripts = [
  "verify:scope-lock",
  "verify:golden-scenario-map",
  "verify:future-capabilities",
] as const;

for (const script of scripts) {
  console.log(`\n>>> npm run ${script}\n`);
  execSync(`npm run ${script}`, { stdio: "inherit", cwd: process.cwd() });
}

console.log("\nverify:phase4-scope-lock OK (all Phase 4 gates green)");
