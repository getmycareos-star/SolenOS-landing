import { nowIso } from "./defaults";
import { assertNotForbiddenTrigger } from "./evidence";
import type {
  ForbiddenResolutionTrigger,
  ResolutionEvidence,
  ResolutionEvidenceKind,
  ResolutionSignalDetection,
} from "./types";

type PatternRule = {
  kind: ResolutionEvidenceKind;
  pattern: RegExp;
  source: ResolutionEvidence["source"];
};

/** Surface-language detectors for valid evidence — never time/idle based. */
const EVIDENCE_PATTERNS: readonly PatternRule[] = [
  {
    kind: "USER_CONFIRMATION",
    pattern:
      /\b(issue (is )?(handled|resolved|done|taken care of)|confirm(ed|ing)? (it'?s |that )?(handled|resolved|done|complete)|yes[,.]? (it'?s |that'?s )?(handled|done|resolved)|I (already )?(handled|finished|completed) (it|this|that))\b/i,
    source: "user_input",
  },
  {
    kind: "COMPLETION_EVENT",
    pattern:
      /\b(picked up (the |her |his |their )?(medication|meds|prescription|rx)|medication (was )?picked up|pharmacy (pickup|pick-up) (done|complete)|filled (the )?prescription)\b/i,
    source: "user_input",
  },
  {
    kind: "APPROVAL_EVENT",
    pattern:
      /\b(insurance (appeal )?(was )?(approved|accepted)|appeal approved|claim approved|coverage (was )?approved)\b/i,
    source: "approval",
  },
  {
    kind: "FULFILLMENT_EVENT",
    pattern:
      /\b(discharge instructions (are |were )?(completed|done|finished)|completed (all )?discharge instructions|follow[- ]up (tasks? )?(completed|done))\b/i,
    source: "fulfillment",
  },
  {
    kind: "SUPERSEDING_EVENT",
    pattern:
      /\b(new discharge (paperwork|instructions|summary)|updated discharge|replaces? (the )?previous (discharge|workflow|plan)|supersede[sd]? (the )?(old|previous))\b/i,
    source: "document",
  },
];

const FORBIDDEN_PHRASE_CHECKS: ReadonlyArray<{
  trigger: ForbiddenResolutionTrigger;
  pattern: RegExp;
}> = [
  {
    trigger: "ELAPSED_TIME",
    pattern: /\b(enough time (has )?passed|auto[- ]?close after|timed out|stale after \d+)\b/i,
  },
  {
    trigger: "INACTIVITY",
    pattern: /\b(no activity for|inactive for|due to inactivity)\b/i,
  },
  {
    trigger: "LACK_OF_USER_INTERACTION",
    pattern: /\b(user (has )?not (responded|interacted)|no user interaction|gone quiet)\b/i,
  },
  {
    trigger: "LOW_CONFIDENCE",
    pattern: /\b(low confidence (so |→ )?resolv|resolve because (we are )?unsure)\b/i,
  },
  {
    trigger: "SYSTEM_ASSUMPTION",
    pattern: /\b(probably (already )?resolved|assume (it'?s |that it'?s )?done|system assumes? (resolved|complete))\b/i,
  },
];

/**
 * Evaluate resolution signals from user text / document surface.
 * Does NOT auto-resolve — callers decide whether to apply evidence.
 * NEVER proposes evidence from time / inactivity alone.
 */
export function evaluateResolutionSignals(params: {
  input: string;
  sourceType?: "text" | "document";
  /** Explicit trigger label attempts (e.g. idle job) — always rejected. */
  attemptedTrigger?: string;
  nowMs?: number;
}): ResolutionSignalDetection {
  const rejectedForbiddenTriggers: ForbiddenResolutionTrigger[] = [];

  if (params.attemptedTrigger) {
    const check = assertNotForbiddenTrigger(params.attemptedTrigger);
    if (!check.ok) {
      rejectedForbiddenTriggers.push(check.trigger);
    }
  }

  for (const { trigger, pattern } of FORBIDDEN_PHRASE_CHECKS) {
    if (pattern.test(params.input)) {
      rejectedForbiddenTriggers.push(trigger);
    }
  }

  // If the input is ONLY a forbidden auto-resolve request, do not propose evidence.
  const trimmed = params.input.trim();
  if (!trimmed) {
    return {
      proposedEvidence: null,
      rejectedForbiddenTriggers: [...new Set(rejectedForbiddenTriggers)],
      supersedeRecommended: false,
    };
  }

  let proposedEvidence: ResolutionEvidence | null = null;
  let supersedeRecommended = false;

  for (const rule of EVIDENCE_PATTERNS) {
    if (rule.pattern.test(params.input)) {
      const source =
        params.sourceType === "document" && rule.kind === "SUPERSEDING_EVENT"
          ? ("document" as const)
          : rule.source;
      proposedEvidence = {
        kind: rule.kind,
        detail: params.input.slice(0, 400),
        source,
        recordedAt: nowIso(params.nowMs),
        confidence: 0.75,
      };
      if (rule.kind === "SUPERSEDING_EVENT") {
        supersedeRecommended = true;
      }
      break; // first match wins — deterministic
    }
  }

  // Forbidden phrases never become proposed evidence.
  if (rejectedForbiddenTriggers.length > 0 && proposedEvidence) {
    // Keep evidence only when it is a distinct valid kind, not idle/time.
    // If the ONLY match was somehow forbidden — already handled by separate patterns.
  }

  return {
    proposedEvidence,
    rejectedForbiddenTriggers: [...new Set(rejectedForbiddenTriggers)],
    supersedeRecommended,
  };
}
