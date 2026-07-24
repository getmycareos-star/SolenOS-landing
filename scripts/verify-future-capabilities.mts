/**
 * verify-future-capabilities.mts
 * Future capability contracts — Phase 2/3, NOT MVP pillars.
 */

import "./_verify-env.mts";
import fs from "node:fs";
import path from "node:path";

import {
  assertFutureCapabilityNotMvp,
  CARE_MOMENT_RESPONSE_FRAMEWORK,
  CARE_UNDERSTANDING_CONFIDENCE_IDENTITY,
  CHAOS_FIRST_INGESTION,
  COMMUNICATION_OUTPUT_SECTIONS,
  FUTURE_CAPABILITY_IDS,
  FUTURE_CAPABILITY_REGISTRY,
  HUMAN_CONTEXT_LAYERS,
  I_NEED_CLARITY_RESPONSE_SECTIONS,
  scanForbiddenConfidenceScores,
} from "../src/lib/future-capabilities";
import { FUTURE_CAPABILITIES } from "../src/lib/solenos-layers/architecture-map";
import {
  FORBIDDEN_FEATURE_CATEGORIES,
  scanForbiddenOutput,
} from "../src/lib/forbidden-build-zone";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(FUTURE_CAPABILITIES.notANewPillar === true, "Future capabilities must not be pillars");
  assert(FUTURE_CAPABILITIES.status === "FUTURE", "Registry status must be FUTURE");
  assert(FUTURE_CAPABILITY_IDS.length >= 6, "Six future capabilities registered");
  assert(CHAOS_FIRST_INGESTION.status === "IMPLEMENTED", "Chaos-first via adoption wedge");

  for (const id of FUTURE_CAPABILITY_IDS) {
    assert(FUTURE_CAPABILITY_REGISTRY[id].status === "FUTURE", `${id} must be FUTURE`);
  }

  assert(
    FORBIDDEN_FEATURE_CATEGORIES.includes("generic_communication_assistant"),
    "FBZ must block generic communication assistant",
  );
  assert(
    FORBIDDEN_FEATURE_CATEGORIES.includes("gamified_care_scores"),
    "FBZ must block gamified scores",
  );

  const blockedComm = assertFutureCapabilityNotMvp("Build Help Me Communicate This UI");
  assert(blockedComm.blocked, "Help Me Communicate UI must be blocked for MVP");
  assert(blockedComm.matched === "help_me_communicate_this", "Must match help_me_communicate_this");

  const blockedMoment = assertFutureCapabilityNotMvp("Care Moment capture screen");
  assert(blockedMoment.blocked, "Care Moment UI must be blocked for MVP");

  assert(
    CARE_MOMENT_RESPONSE_FRAMEWORK.length === 5,
    "Care Moment must have five response sections",
  );
  assert(
    I_NEED_CLARITY_RESPONSE_SECTIONS.length === 5,
    "I Need Clarity must have five sections",
  );
  assert(
    COMMUNICATION_OUTPUT_SECTIONS.length === 4,
    "Communication support must have four output sections",
  );
  assert(HUMAN_CONTEXT_LAYERS.length === 7, "Seven human context layers");

  const scoreViolations = scanForbiddenConfidenceScores(
    "Your caregiving confidence: 72%",
  );
  assert(scoreViolations.length > 0, "Must detect forbidden confidence scores");

  const outputViolations = scanForbiddenOutput(
    "Your caregiving confidence: 85%",
  );
  assert(outputViolations.length > 0, "FBZ output scan must catch score patterns");

  assert(
    CARE_UNDERSTANDING_CONFIDENCE_IDENTITY.includes("understand"),
    "Confidence principle must be about understanding not scoring",
  );

  assert(
    fs.existsSync(path.join(root, "docs/FUTURE_CAPABILITIES.md")),
    "FUTURE_CAPABILITIES doc must exist",
  );
  assert(
    fs.existsSync(path.join(root, ".cursor/rules/solenos-future-capabilities.mdc")),
    "Cursor rule must exist",
  );

  // Caregiver surface must not ship Phase 2/3 UI or ADR-018 voice as MVP.
  const caregiverRoots = [
    "src/components/mvp-workspace",
    "src/app/page.tsx",
  ];
  const bannedSurface = [
    /Help Me Communicate This/i,
    /\bCare Moment\b/,
    /I Need Clarity/i,
    /Care Understanding Confidence/i,
    /Your caregiving confidence:\s*\d+\s*%/i,
    /useWebSpeechRecognition/,
    /btn-mic/,
    /ObservationInput/,
  ];
  for (const rel of caregiverRoots) {
    const full = path.join(root, rel);
    const files = fs.statSync(full).isDirectory()
      ? fs.readdirSync(full).filter((f) => /\.(tsx?|jsx?)$/.test(f)).map((f) => path.join(full, f))
      : [full];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const re of bannedSurface) {
        assert(!re.test(src), `${path.relative(root, file)} must not contain ${re}`);
      }
    }
  }

  const uiRuntimeIndex = fs.readFileSync(
    path.join(root, "src/components/ui-runtime/index.ts"),
    "utf8",
  );
  assert(
    !/export\s*\{\s*ObservationInput\s*\}/.test(uiRuntimeIndex),
    "ObservationInput must not be re-exported for caregiver MVP (ADR-018)",
  );
  const observationInput = fs.readFileSync(
    path.join(root, "src/components/ui-runtime/ObservationInput.tsx"),
    "utf8",
  );
  assert(/FUTURE|ADR-018/i.test(observationInput), "ObservationInput must be labeled FUTURE");
  assert(!/\(MVP\)/.test(observationInput), "ObservationInput must not claim MVP voice");

  const voiceGate = assertFutureCapabilityNotMvp("Build voice input mic UI for caregivers");
  assert(voiceGate.blocked, "Voice mic UI must be blocked for MVP");

  console.log("verify:future-capabilities OK");
}

main();
