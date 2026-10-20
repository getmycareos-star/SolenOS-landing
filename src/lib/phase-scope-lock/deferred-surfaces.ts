/**
 * Deferred caregiver / spine surfaces — static scan + assertFutureCapabilityNotMvp.
 * Used by verify:scope-lock and PR changed-file validation.
 */
import { assertFutureCapabilityNotMvp } from "../future-capabilities";
import { assertPhaseScopeLockNotMvp } from "./gates";

/** Paths (prefix match) that must pass deferred-scope gates on every PR touch. */
export const DEFERRED_SURFACE_PATH_PREFIXES = [
  "src/components/mvp-workspace/",
  "src/app/page.tsx",
  "src/lib/situation-entry/pipeline.ts",
  "src/lib/situation-entry/caregiver-response-dto.ts",
  "src/lib/living-care-record-ux/",
  "src/lib/caregiver-response-composer/",
  "src/components/ui-runtime/index.ts",
] as const;

export type DeferredSurfaceViolation = {
  path: string;
  match: string;
  gate: "assertFutureCapabilityNotMvp" | "assertPhaseScopeLockNotMvp";
  reason: string;
};

/** Banned patterns in deferred caregiver surfaces → gate probe text. */
const SURFACE_PATTERN_PROBES: Array<{
  pattern: RegExp;
  probe: string;
  gate: DeferredSurfaceViolation["gate"];
}> = [
  { pattern: /Help Me Communicate This/i, probe: "Help Me Communicate This UI", gate: "assertFutureCapabilityNotMvp" },
  { pattern: /\bCare Moment\b/i, probe: "Care Moment capture screen", gate: "assertFutureCapabilityNotMvp" },
  { pattern: /I Need Clarity/i, probe: "I Need Clarity UI panel", gate: "assertFutureCapabilityNotMvp" },
  { pattern: /Care Understanding Confidence/i, probe: "Care Understanding Confidence screens", gate: "assertFutureCapabilityNotMvp" },
  {
    pattern: /Your caregiving confidence:\s*\d+\s*%/i,
    probe: "Your caregiving confidence: 72%",
    gate: "assertFutureCapabilityNotMvp",
  },
  { pattern: /useWebSpeechRecognition/i, probe: "voice input mic UI useWebSpeechRecognition", gate: "assertFutureCapabilityNotMvp" },
  { pattern: /btn-mic\b/i, probe: "voice input mic UI btn-mic", gate: "assertFutureCapabilityNotMvp" },
  { pattern: /SituationGraph(?:Panel|View|UI)/i, probe: "Situation Graph UI component", gate: "assertPhaseScopeLockNotMvp" },
  {
    pattern: /fetch\s*\(\s*["']\/api\/analyze["']/i,
    probe: "CognitiveWorkspace primary caregiver path POST /api/analyze",
    gate: "assertPhaseScopeLockNotMvp",
  },
  {
    pattern: /care_situations.*(?:runtime|product|primary)/i,
    probe: "wire care_situations postgres graph as product path runtime truth",
    gate: "assertPhaseScopeLockNotMvp",
  },
  {
    pattern: /evaluateFeatureAgainstNorthStar[\s\S]{0,80}composeCaregiverResponse/i,
    probe: "runtime north star gate block compose evaluateFeatureAgainstNorthStar",
    gate: "assertPhaseScopeLockNotMvp",
  },
];

export function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function isDeferredSurfacePath(filePath: string): boolean {
  const rel = normalizeRepoPath(filePath);
  return DEFERRED_SURFACE_PATH_PREFIXES.some(
    (prefix) => rel === prefix.replace(/\/$/, "") || rel.startsWith(prefix),
  );
}

function runGate(gate: DeferredSurfaceViolation["gate"], probe: string): { blocked: boolean; reason: string } {
  if (gate === "assertFutureCapabilityNotMvp") {
    const r = assertFutureCapabilityNotMvp(probe);
    return { blocked: r.blocked, reason: r.reason };
  }
  const r = assertPhaseScopeLockNotMvp(probe);
  return { blocked: r.blocked, reason: r.reason };
}

/** Scan file content on a deferred surface path; returns violations (non-throwing). */
export function scanDeferredSurfaceContent(
  filePath: string,
  content: string,
): DeferredSurfaceViolation[] {
  const rel = normalizeRepoPath(filePath);
  if (!isDeferredSurfacePath(rel)) {
    return [];
  }

  const violations: DeferredSurfaceViolation[] = [];
  for (const { pattern, probe, gate } of SURFACE_PATTERN_PROBES) {
    const m = content.match(pattern);
    if (!m) continue;
    const gateResult = runGate(gate, probe);
    if (gateResult.blocked) {
      violations.push({
        path: rel,
        match: m[0]!,
        gate,
        reason: gateResult.reason,
      });
    }
  }
  return violations;
}

/** Throws if deferred surface file ships blocked MVP scope. */
export function assertDeferredSurfaceFile(filePath: string, content: string): void {
  const violations = scanDeferredSurfaceContent(filePath, content);
  if (violations.length === 0) return;
  const v = violations[0]!;
  throw new Error(
    `[${v.gate}] ${v.path}: matched "${v.match}" — ${v.reason}`,
  );
}

/** PR helper — validate changed files against deferred surface gates. */
export function validateChangedFilesForDeferredScope(changedFiles: string[]): {
  ok: boolean;
  violations: DeferredSurfaceViolation[];
} {
  const violations: DeferredSurfaceViolation[] = [];
  for (const file of changedFiles) {
    if (!isDeferredSurfacePath(file)) continue;
    // Caller must pass content via assertDeferredSurfaceFile in CI; this validates path membership only.
    violations.push({
      path: normalizeRepoPath(file),
      match: "(path)",
      gate: "assertPhaseScopeLockNotMvp",
      reason: "Deferred surface touched — run npm run verify:scope-lock before merge",
    });
  }
  return { ok: violations.length === 0, violations };
}

/** Run assertFutureCapabilityNotMvp for all registered future-capability probes (smoke). */
export function assertAllFutureCapabilityProbesBlocked(): Array<{ probe: string; blocked: boolean }> {
  const probes = [
    "Care Moment capture screen",
    "I Need Clarity UI",
    "Help Me Communicate This UI",
    "Care Understanding Confidence screens",
    "Build voice input mic UI for caregivers",
  ];
  return probes.map((probe) => ({
    probe,
    blocked: assertFutureCapabilityNotMvp(probe).blocked,
  }));
}
