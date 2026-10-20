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
    specialist: {
      pattern: /\b(specialist|spclist)\b/i,
      label: "specialist care",
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
      pattern: /\b(medication|med|drug|prescription|pill|dose|dosage)\b/i,
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
  
  // Handle uncertainty_level specially since it uses a different pattern
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

function assessDecisionContext(context: CareContext): string[] {
  const considerations: string[] = [];
  
  if (!context.decisions || context.decisions.length === 0) {
    return considerations;
  }
  
  // Count decisions by status
  const currentDecisions = context.decisions.filter(d => d.status === "CURRENT");
  const historicalDecisions = context.decisions.filter(d => d.status === "HISTORICAL");
  const supersededDecisions = context.decisions.filter(d => d.status === "SUPERSEDED");
  const cancelledDecisions = context.decisions.filter(d => d.status === "CANCELLED");
  const reconsideredDecisions = context.decisions.filter(d => d.status === "RECONSIDERED");
  
  considerations.push(
    `Care context includes ${currentDecisions.length} current decision(s), ${historicalDecisions.length} historical decision(s), ${supersededDecisions.length} superseded decision(s), ${cancelledDecisions.length} cancelled decision(s), and ${reconsideredDecisions.length} reconsidered decision(s).`
  );
  
  // Add information about decision outcomes
  const decisionsWithKnownOutcomes = context.decisions.filter(d => d.actual_outcome !== null);
  const decisionsWithUnknownOutcomes = context.decisions.filter(d => d.actual_outcome === null);
  
  if (decisionsWithKnownOutcomes.length > 0) {
    considerations.push(
      `${decisionsWithKnownOutcomes.length} decision(s) have documented outcomes.`
    );
  }
  
  if (decisionsWithUnknownOutcomes.length > 0) {
    considerations.push(
      `${decisionsWithUnknownOutcomes.length} decision(s) have pending outcomes awaiting observation.`
    );
  }
  
  // Add information about expected vs actual outcomes
  const decisionsWithOutcomeComparison = context.decisions.filter(
    d => d.outcome_comparison !== "unknown" && d.outcome_comparison !== "pending"
  );
  
  if (decisionsWithOutcomeComparison.length > 0) {
    const achievedCount = decisionsWithOutcomeComparison.filter(
      d => d.outcome_comparison === "achieved"
    ).length;
    
    considerations.push(
      `Of decisions with comparable outcomes, ${achievedCount} achieved their expected outcomes.`
    );
  }
  
  return considerations;
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

  // Add decision-specific guidance
  const decisionGuidance = deriveDecisionGuidance(context);
  actions.push(...decisionGuidance);

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

function deriveDecisionGuidance(context: CareContext): PrioritizedAction[] {
  const guidance: PrioritizedAction[] = [];
  
  if (!context.decisions || context.decisions.length === 0) {
    return guidance;
  }
  
  // Check for decisions that need reconsideration
  const decisionsNeedingReview = context.decisions.filter(
    d => d.status === "CURRENT" && 
         (d.actual_outcome === null && d.expected_outcome !== null) &&
         (d.follow_up_date === null || new Date(d.follow_up_date) <= new Date())
  );
  
  if (decisionsNeedingReview.length > 0) {
    guidance.push({
      action: "Review recent decisions for which expected outcomes should be observable",
      urgency: "soon",
      reason: `${decisionsNeedingReview.length} decision(s) have expected outcomes that should be reviewable now.`
    });
  }
  
  // Check for decisions with conflicting outcomes
  const decisionsWithConflictingOutcomes = context.decisions.filter(
    d => d.outcome_comparison === "conflicting"
  );
  
  if (decisionsWithConflictingOutcomes.length > 0) {
    guidance.push({
      action: "Investigate conflicting reports about decision outcomes",
      urgency: "soon",
      reason: `${decisionsWithConflictingOutcomes.length} decision(s) have conflicting outcome reports requiring clarification.`
    });
  }
  
  // Check for decisions that were recently superseded
  const recentlySuperseded = context.decisions.filter(
    d => d.status === "SUPERSEDED" && d.superseded_by !== null
  );
  
  if (recentlySuperseded.length > 0) {
    guidance.push({
      action: "Review care plan evolution following recent decision changes",
      urgency: "when_possible",
      reason: `${recentlySuperseded.length} decision(s) have been recently superseded, indicating evolution in care approach.`
    });
  }
  
  return guidance;
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
    "specialist",
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
  const decisionContext = assessDecisionContext(context);

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
    decisionContext: decisionContext.join(" "),
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
    "---",
    "",
    `CAREGIVER LOAD: ${reasoning.caregiverLoad.level} (score: ${reasoning.caregiverLoad.score})`,
    "",
    "---",
    "",
    `DECISION CONTEXT:`,
    reasoning.decisionContext
      ? `  ${reasoning.decisionContext}`
      : "  No decision context available",
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