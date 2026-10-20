import type {
  CareContext,
  ContextCareEvent,
  ContextCheck,
  ContextCheckDimension,
  ContextReasoning,
  PrioritizedAction,
} from "./types";
import { computeDiff } from "./engines/diff-engine";
import { assessStateOfCare } from "./engines/state-of-care-engine";
import { assessCaregiverLoad } from "./engines/caregiver-load-engine";
import { deriveClarifications } from "./engines/clarification-engine";
import { detectPatterns } from "./engines/pattern-learning-engine";
import { attachTrustToActions } from "./engines/trust-layer";

function assessDimension(
  dimension: ContextCheckDimension,
  context: CareContext,
  recentWindow: ContextCareEvent[],
  priorWindow: ContextCareEvent[],
): ContextCheck {
  const recent = recentWindow;
  const prior = priorWindow;

  const configs: Record<
    ContextCheckDimension,
    { pattern: RegExp; label: string }
  > = {
    caregiver_burden: {
      pattern: /\b(exhaust|burn|overwhelm|can't cope|stressed)\b/i,
      label: "caregiver burden",
    },
    mobility: {
      pattern: /\b(fell|fall|mobility|walk|wheelchair|unsteady)\b/i,
      label: "mobility",
    },
    nighttime_events: {
      pattern: /\b(night|overnight|evening|midnight|sundown)\b/i,
      label: "nighttime events",
    },
    supervision_demand: {
      pattern: /\b(supervision|watch|monitor|24\s*\/\s*7|wander)\b/i,
      label: "supervision demand",
    },
    wandering_frequency: {
      pattern: /\b(wander(?:ing)?)\b/i,
      label: "wandering",
    },
    medication_changes: {
      pattern: /\b(medication|med|pill|dose|prescription|changed|missed|forgot)\b/i,
      label: "medication",
    },
    uncertainty_level: {
      pattern: /.*/,
      label: "uncertainty",
    },
    crisis_frequency: {
      pattern: /\b(emergency|er\b|hospital|911|crisis|urgent)\b/i,
      label: "crisis events",
    },
  };

  const config = configs[dimension];

  if (dimension === "uncertainty_level") {
    const recentCount = context.uncertainties.length;
    return {
      dimension,
      finding:
        recentCount >= 3
          ? "increased"
          : recentCount >= 1
            ? "unchanged"
            : "not_observed",
      evidence:
        recentCount > 0
          ? context.uncertainties
          : ["No open uncertainties recorded"],
    };
  }

  const recentMatches = recent.filter((e) => config.pattern.test(e.description));
  const priorMatches = prior.filter((e) => config.pattern.test(e.description));

  let finding: ContextCheck["finding"];
  if (recentMatches.length === 0 && priorMatches.length === 0) {
    finding = "not_observed";
  } else if (recentMatches.length > priorMatches.length) {
    finding = "increased";
  } else if (recentMatches.length < priorMatches.length) {
    finding = "decreased";
  } else {
    finding = "unchanged";
  }

  const evidence =
    recentMatches.length > 0
      ? recentMatches.map((e) => e.description)
      : priorMatches.length > 0
        ? [`Prior only: ${priorMatches[0].description}`]
        : [`No ${config.label} recorded`];

  return { dimension, finding, evidence };
}

function splitTimelineWindows(context: CareContext) {
  const sorted = [...context.timeline].sort((a, b) => {
    const da = a.date ?? a.recordedAt;
    const db = b.date ?? b.recordedAt;
    return da.localeCompare(db);
  });
  const midpoint = Math.floor(sorted.length / 2);
  return {
    prior: sorted.slice(0, midpoint),
    recent: sorted.slice(midpoint),
  };
}

function deriveGuidance(
  checks: ContextCheck[],
  context: CareContext,
  clarifications: ContextReasoning["clarificationsNeeded"],
): PrioritizedAction[] {
  const actions: PrioritizedAction[] = [];
  const blockingClarifications = clarifications.filter(
    (c) => c.priority === "blocking",
  );

  if (blockingClarifications.length > 0) {
    actions.push({
      action: "Provide additional context before making care level decisions",
      urgency: "now",
      reason: `Blocking uncertainty: ${blockingClarifications[0].reducesUncertainty}`,
    });
  }

  const increasedChecks = checks.filter((c) => c.finding === "increased");

  if (
    increasedChecks.some((c) =>
      ["caregiver_burden", "supervision_demand", "wandering_frequency"].includes(
        c.dimension,
      ),
    )
  ) {
    actions.push({
      action: "Evaluate whether current care support matches observed needs",
      urgency: "soon",
      reason:
        "Multiple care demand indicators have increased — professional help assessment may be warranted",
    });
  }

  if (
    increasedChecks.some((c) =>
      ["nighttime_events", "crisis_frequency", "mobility"].includes(c.dimension),
    )
  ) {
    actions.push({
      action: "Consult with an appropriate healthcare professional",
      urgency: "soon",
      reason:
        "Safety-relevant changes detected in nighttime events, mobility, or crisis frequency",
    });
  }

  if (actions.length === 0 && context.timeline.length >= 3) {
    actions.push({
      action: "Continue documenting observations to refine care understanding",
      urgency: "when_possible",
      reason:
        "No strong indicators for immediate care level change — continuity monitoring recommended",
    });
  }

  return actions;
}

/**
 * Reason through CareContext before generating guidance.
 * SolenOS does NOT immediately answer decision questions.
 */
export function reasonThroughContext(
  context: CareContext,
  question: string,
): ContextReasoning {
  const { prior, recent } = splitTimelineWindows(context);

  const dimensions: ContextCheckDimension[] = [
    "caregiver_burden",
    "mobility",
    "nighttime_events",
    "supervision_demand",
    "wandering_frequency",
    "medication_changes",
    "uncertainty_level",
    "crisis_frequency",
  ];

  const contextChecks = dimensions.map((d) =>
    assessDimension(d, context, recent, prior),
  );

  const diff = computeDiff(context);
  const stateOfCare = assessStateOfCare(context);
  const caregiverLoad = assessCaregiverLoad(context);
  const clarificationsNeeded = deriveClarifications(context);
  const patterns = detectPatterns(context);

  const enrichedContext: CareContext = {
    ...context,
    stateOfCare,
    caregiverLoad,
    patterns,
  };

  const rawGuidance = deriveGuidance(
    contextChecks,
    enrichedContext,
    clarificationsNeeded,
  );
  const guidance = attachTrustToActions(rawGuidance, enrichedContext);

  return {
    question,
    contextChecks,
    diff,
    stateOfCare,
    caregiverLoad,
    clarificationsNeeded,
    guidance,
    patterns,
    reasoningNote:
      "Guidance derived from evolving CareContext — not an isolated answer. SolenOS reduces uncertainty before recommending.",
  };
}

export function formatContextReasoning(reasoning: ContextReasoning): string {
  const sections: string[] = [
    "CONTEXT REASONING (not an immediate answer)",
    "",
    `Question: ${reasoning.question}`,
    "",
    reasoning.reasoningNote,
    "",
    "---",
    "",
    "CONTEXT CHECKS",
  ];

  for (const check of reasoning.contextChecks) {
    sections.push(
      `- ${check.dimension.replace(/_/g, " ")}: ${check.finding}`,
    );
    for (const e of check.evidence.slice(0, 2)) {
      sections.push(`    evidence: ${e}`);
    }
  }

  sections.push("", "---", "", reasoning.diff.headline);
  if (reasoning.diff.summary.length > 0) {
    for (const s of reasoning.diff.summary) sections.push(`- ${s}`);
  }

  sections.push(
    "",
    "---",
    "",
    `STATE OF CARE: ${reasoning.stateOfCare.trajectory}`,
    reasoning.stateOfCare.summary,
    "",
    `CAREGIVER LOAD: ${reasoning.caregiverLoad.level} (score: ${reasoning.caregiverLoad.score})`,
  );

  if (reasoning.clarificationsNeeded.length > 0) {
    sections.push("", "---", "", "CLARIFICATIONS NEEDED (reduce uncertainty)");
    for (const c of reasoning.clarificationsNeeded) {
      sections.push(`- [${c.priority}] ${c.question}`);
      sections.push(`  enables: ${c.enables}`);
    }
  }

  if (reasoning.guidance.length > 0) {
    sections.push("", "---", "", "GUIDANCE (continuity-based)");
    for (const g of reasoning.guidance) {
      sections.push(`- [${g.urgency}] ${g.action}`);
      sections.push(`  reason: ${g.reason}`);
      if (g.trust) {
        sections.push(
          `  confidence: ${g.trust.confidenceLevel} — ${g.trust.confidenceReason}`,
        );
      }
    }
  }

  if (reasoning.patterns.length > 0) {
    sections.push("", "---", "", "PATTERNS (correlation, not causation)");
    for (const p of reasoning.patterns) {
      sections.push(`- ${p.pattern} (${p.occurrences} occurrences)`);
    }
  }

  return sections.join("\n");
}
