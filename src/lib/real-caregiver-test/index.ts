/**
 * G61 — The Real Caregiver Test (feature approval).
 *
 * > If a daughter using SolenOS at 2 AM after a difficult day saw this,
 * > would she feel more capable of caring for her parent?
 *
 * Pass: calmer · clearer · more oriented · less alone in the complexity
 * Fail: more confused · more work · more questions without direction · software admin
 *
 * Principle checks on composed caregiver response — not scenario phrase patches.
 */

import type { ComposedCaregiverResponse } from "../caregiver-response-composer";
import {
  assertComposedResponseProfessional,
  CAREGIVER_RESPONSE_BANNED_PHRASES,
} from "../caregiver-response-composer";

export const REAL_CAREGIVER_TEST_PURPOSE =
  "Feature approval gate: exhausted caregiver at 2AM feels more capable — not administered.";

export type RealCaregiverTestResult = {
  pass: boolean;
  fails: string[];
};

function joinedVisible(composed: ComposedCaregiverResponse): string {
  return [
    composed.recognition_line ?? "",
    composed.confirmation,
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.connection_note ?? "",
    composed.care_story_update ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
    composed.what_matters_now ?? "",
    composed.what_can_wait ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function hasBannedPhrase(composed: ComposedCaregiverResponse): boolean {
  const blob = joinedVisible(composed);
  return CAREGIVER_RESPONSE_BANNED_PHRASES.some((p) =>
    blob.includes(p.toLowerCase()),
  );
}

/**
 * Evaluate a composed caregiver response against the G61 orientation bar.
 */
export function evaluateRealCaregiverTest(
  composed: ComposedCaregiverResponse,
): RealCaregiverTestResult {
  const fails: string[] = [];
  const text = joinedVisible(composed);

  try {
    assertComposedResponseProfessional(composed);
  } catch (e) {
    fails.push(
      e instanceof Error ? e.message : "composer professional contract failed",
    );
  }

  if (hasBannedPhrase(composed)) {
    fails.push("banned phrase present (diagnosis / empathy theater / empty reassure)");
  }

  if (!composed.confirmation?.trim()) {
    fails.push("no confirmation — caregiver not oriented that something was held");
  }

  const orients =
    Boolean(composed.what_changed?.trim()) ||
    Boolean(composed.situation_summary?.trim()) ||
    (composed.what_we_know?.length ?? 0) > 0;
  if (!orients) {
    fails.push("no orientation surface (what changed / happening / known)");
  }

  if ((composed.still_unclear?.length ?? 0) > 3) {
    fails.push("too many asks — more work without direction");
  }

  // Cognitive load: visible body must stay scannable at 2AM
  const bodyLen = [
    composed.confirmation,
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
  ].join(" ").length;
  if (bodyLen > 1200) {
    fails.push("response too long — cognitive dump at 2AM");
  }

  // Software administration / tracking burden
  if (
    /daily check-?in|fill out|dashboard|please categorize|complete your profile|homework|set up your account/i.test(
      text,
    )
  ) {
    fails.push("feels like software administration");
  }

  // Confusion: dump of history or reconstruction demand — not “so you do not have to reconstruct”
  if (
    /as you (?:may )?remember|you (?:will )?need to recall|from the beginning|list everything/i.test(
      text,
    ) ||
    (/\breconstruct\b/i.test(text) &&
      !/\b(?:do not|don't|never|without|no need to)\b.{0,24}\breconstruct\b/i.test(text))
  ) {
    fails.push("asks caregiver to reconstruct the journey");
  }

  // Alone in complexity: empty cheer without holding reality
  if (
    /everything will be fine|don't worry|perfectly normal/i.test(text) &&
    !(composed.what_we_know?.length || composed.what_changed)
  ) {
    fails.push("empty reassurance without held care reality");
  }

  return { pass: fails.length === 0, fails };
}

export function assertRealCaregiverTest(
  composed: ComposedCaregiverResponse,
  label = "G61",
): void {
  const result = evaluateRealCaregiverTest(composed);
  if (!result.pass) {
    throw new Error(`${label} failed:\n- ${result.fails.join("\n- ")}`);
  }
}

/** Compose-path gate mode — Slice 5.5 / ADR-025 (amended). */
export type G61ComposeGateMode = "off" | "throw" | "log";

/**
 * Resolve whether G61 runs after the acceptance gate on compose.
 *
 * - Default **dev/non-prod**: `throw` on fail (surfaces quality early).
 * - Default **production**: `off` (never slows prod unless flagged).
 * - `SOLENOS_G61_COMPOSE_GATE=1`: on — `throw` non-prod, `log` in prod (never blocks capture).
 * - `SOLENOS_G61_COMPOSE_GATE=0`: force off.
 * - `SOLENOS_VERIFY=1`: off by default so CI uses explicit `assertRealCaregiverTest` (opt-in with flag=1).
 */
export function resolveG61ComposeGateMode(
  env: NodeJS.ProcessEnv = process.env,
): G61ComposeGateMode {
  const flag = (env.SOLENOS_G61_COMPOSE_GATE ?? "").trim().toLowerCase();
  if (flag === "0" || flag === "off" || flag === "false") return "off";

  const isProd = env.NODE_ENV === "production";
  if (flag === "1" || flag === "on" || flag === "true") {
    return isProd ? "log" : "throw";
  }

  if ((env.SOLENOS_VERIFY ?? "").trim() === "1") return "off";
  if (isProd) return "off";
  return "throw";
}

export type ApplyG61ComposeGateParams = {
  composed: ComposedCaregiverResponse;
  /** Skip empty/meta/identity turns — G61 is for care orientation, not empty updates. */
  turnClass?: string | null;
  env?: NodeJS.ProcessEnv;
  /** Test seam — defaults to console.warn */
  log?: (message: string) => void;
};

/**
 * Optional compose-path G61 after acceptance gate.
 * Never blocks capture (ingest already committed). Prod mode logs only — never throws.
 */
export function applyRealCaregiverTestComposeGate(
  params: ApplyG61ComposeGateParams,
): RealCaregiverTestResult | null {
  const mode = resolveG61ComposeGateMode(params.env ?? process.env);
  if (mode === "off") return null;

  const turnClass = params.turnClass ?? "";
  if (turnClass === "empty_or_thin" || turnClass === "identity_mismatch") {
    return null;
  }

  const result = evaluateRealCaregiverTest(params.composed);
  if (result.pass) return result;

  const message = `G61 Real Caregiver Test failed:\n- ${result.fails.join("\n- ")}`;
  if (mode === "throw") {
    throw new Error(message);
  }

  // Prod / log mode — surface for ops; never throw (capture + response still return).
  const log = params.log ?? ((m: string) => console.warn(`[solenos:g61] ${m}`));
  log(message);
  return result;
}
