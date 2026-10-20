/**
 * Internal Reasoning Layer — pre-projection reasoning before caregiver response.
 *
 * Answers the 13 core questions using ContinuityDecision and CareSituationUnderstanding.
 * Produces a CareReasoningSnapshot that feeds the composer.
 */

import type { ContinuityDecision } from "../care-identity/continuity-detection";
import type { CareSituationUnderstanding } from "../care-situation-understanding/types";
import type {
  CareReasoningSnapshot,
  ReasoningWho,
  ReasoningInformationType,
  ReasoningChange,
  ReasoningPriority,
  ReasoningDeferral,
  ReasoningUnknowns,
  ReasoningQuestions,
  ReasoningEvidence,
  ReasoningRelationships,
  ReasoningMemory,
  ReasoningMonitor,
  ReasoningRevisit,
} from "./types";

/**
 * Answer "Who is this about?" (Question 1)
 */
function reasonWho(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningWho {
  const recipient = understanding.care_recipient;
  const identity = continuityDecision?.identity;

  // Known from durable identity
  if (identity?.display_name) {
    return {
      care_recipient: identity.display_name,
      certainty: "known",
      needs_confirmation: false,
    };
  }

  // Known from understanding (ACS subject or session kinship)
  if (recipient) {
    const fromKinship = /^(Mom|Dad|Grandma|Grandpa)$/i.test(recipient);
    return {
      care_recipient: recipient,
      certainty: fromKinship ? "inferred_from_kinship" : "known",
      needs_confirmation: fromKinship && !identity?.display_name,
    };
  }

  // Unknown — needs identity ask
  return {
    care_recipient: null,
    certainty: "unknown",
    needs_confirmation: true,
  };
}

/**
 * Answer "Is this new information or continuation?" (Question 2)
 */
function reasonInformationType(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningInformationType {
  const inputRelation = continuityDecision?.input_relation;
  const diff = continuityDecision?.care_reality_diff;

  // Use the continuity decision's input relation when available
  const isNewInfo = inputRelation?.is_new_information ?? understanding.facts.length > 0;
  const isContinuation = inputRelation?.is_continuation ?? false;
  const describesChange = inputRelation?.describes_change ?? false;
  const isCorrection = inputRelation?.is_correction ?? false;
  const isEmotionalOnly = inputRelation?.is_emotional_only ?? false;

  // Distinguish new vs continued from the diff
  const newAspects = diff?.added ?? [];
  const continuedAspects = diff?.confirmed ?? [];

  // If no prior context, everything is new information
  if (!continuityDecision?.context.prior_events_exist && understanding.facts.length > 0) {
    newAspects.push(...understanding.facts.map((f) => f.text));
  }

  return {
    is_new_information: isNewInfo && !isContinuation,
    is_continuation: isContinuation || (!isNewInfo && understanding.facts.length > 0),
    describes_change: describesChange || understanding.changes_from_baseline.length > 0,
    is_correction: isCorrection,
    is_emotional_only: isEmotionalOnly,
    new_aspects: [...new Set(newAspects)].slice(0, 5),
    continued_aspects: [...new Set(continuedAspects)].slice(0, 5),
  };
}

/**
 * Answer "What changed?" (Question 3)
 */
function reasonChange(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningChange {
  const diff = continuityDecision?.care_reality_diff;
  const hasPrior = continuityDecision?.context.prior_events_exist ?? false;

  // Collect changes from multiple sources
  const changes: string[] = [
    ...(understanding.changes_from_baseline ?? []),
    ...(diff?.changed ?? []),
    ...(diff?.added ?? []),
    ...(diff?.contradicted ?? []),
  ];

  // For new users without prior, this is an initial assessment
  const hasComparablePrior = hasPrior || (diff?.confirmed.length ?? 0) > 0;

  return {
    has_changes: changes.length > 0,
    changes: [...new Set(changes)].slice(0, 5),
    has_comparable_prior: hasComparablePrior,
    mode: hasComparablePrior ? "change_detection" : "initial_assessment",
  };
}

/**
 * Rank priority based on safety, functional impact, and uncertainty.
 */
function safetyImpactWeight(text: string): number {
  if (
    /\b(?:fell|fall|fallen|collapse|fainted|unconscious|seizure|overdose|injury|broken|fracture|bleed|head injur)\b/i.test(text)
  ) {
    return 6;
  }
  if (
    /\b(?:hospital|emergency|er\b|urgent care|discharge|admitted|surgery|medication chang|dosage chang)\b/i.test(text)
  ) {
    return 5;
  }
  if (
    /\b(?:walking|mobility|balance|stumble|eating|appetite|swallow)\b/i.test(text)
  ) {
    return 4;
  }
  if (
    /\b(?:confus|disorient|wander|agitat|aggress|hallucinat|memory|forget)\b/i.test(text)
  ) {
    return 3;
  }
  if (/\b(?:worse|changed|decline|more (?:often|frequent|difficult))\b/i.test(text)) {
    return 2;
  }
  return 1;
}

/**
 * Answer "What matters most?" and "What can wait?" (Questions 4 & 5)
 */
function reasonPriority(
  understanding: CareSituationUnderstanding,
): { priority: ReasoningPriority; deferral: ReasoningDeferral } {
  const allItems = [
    ...understanding.matters_now.map((m) => ({ text: m, source: "matters_now" as const })),
    ...understanding.changes_from_baseline.map((c) => ({ text: c, source: "change" as const })),
    ...understanding.facts.map((f) => ({ text: f.text, source: "fact" as const })),
  ];

  // Sort by impact weight
  const sorted = [...allItems].sort(
    (a, b) => safetyImpactWeight(b.text) - safetyImpactWeight(a.text),
  );

  const mattersNow: string[] = [];
  const canWait: string[] = [];

  // Safety-critical or functional changes → matters now (max 3)
  for (const item of sorted) {
    const weight = safetyImpactWeight(item.text);
    if (weight >= 4 && mattersNow.length < 3) {
      mattersNow.push(item.text);
    } else if (weight >= 2 && mattersNow.length < 2) {
      mattersNow.push(item.text);
    } else if (canWait.length < 3) {
      canWait.push(item.text);
    }
  }

  // Determine significance
  let significance: ReasoningPriority["significance"] = "low";
  const maxWeight = sorted.length > 0 ? safetyImpactWeight(sorted[0].text) : 0;
  if (maxWeight >= 6) significance = "safety_critical";
  else if (maxWeight >= 4) significance = "functional_change";
  else if (maxWeight >= 2) significance = "emerging_pattern";
  else if (understanding.context_only.length > 0) significance = "contextual";

  const deferReason: ReasoningDeferral["reason"] =
    understanding.context_only.length > 0
      ? "admin_or_load"
      : mattersNow.length === 0
        ? "no_comparable_prior"
        : "not_urgent";

  return {
    priority: {
      matters_now: mattersNow.slice(0, 3),
      can_wait: canWait.slice(0, 3),
      significance,
    },
    deferral: {
      can_wait: canWait.slice(0, 3),
      reason: deferReason,
    },
  };
}

/**
 * Answer "What is unknown?" (Question 6)
 */
function reasonUnknowns(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningUnknowns {
  const priorUnknowns = continuityDecision?.context.open_uncertainties ?? [];
  const priorDiffUnknowns = continuityDecision?.care_reality_diff?.remaining_unknowns ?? [];
  const newUnknowns = continuityDecision?.care_reality_diff?.new_unknowns ?? [];

  // Carry forward prior unknowns that remain unresolved
  const carriedForward = [...new Set([...priorUnknowns, ...priorDiffUnknowns])].filter((u) => {
    // Check if the current understanding answers this unknown
    const uLower = u.toLowerCase();
    const resolved = understanding.facts.some((f) =>
      f.text.toLowerCase().includes(uLower.slice(0, 24)),
    );
    return !resolved;
  });

  // New unknowns from this turn
  const freshUnknowns = [
    ...newUnknowns,
    ...understanding.unknowns.map((u) =>
      u.endsWith("?") ? u : `${u.replace(/\.$/, "")}?`,
    ),
  ];

  // Determine uncertainty level
  const totalUnknowns = carriedForward.length + freshUnknowns.length;
  const remainingUncertainty: ReasoningUnknowns["remaining_uncertainty"] =
    totalUnknowns >= 3 ? "high" : totalUnknowns >= 1 ? "medium" : "low";

  return {
    prior_unknowns_carried_forward: carriedForward.slice(0, 4),
    new_unknowns: [...new Set(freshUnknowns)].slice(0, 3),
    remaining_uncertainty: remainingUncertainty,
  };
}

/**
 * Answer "What questions reduce uncertainty?" (Question 7)
 * Produces targeted questions, not generic ones.
 */
function reasonQuestions(
  unknowns: ReasoningUnknowns,
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningQuestions {
  const questions: string[] = [];

  // Priority 1: Must-know questions about changes (safety/medical)
  for (const change of understanding.changes_from_baseline) {
    if (/\b(?:fell|fall|medication|hospital|discharg)\b/i.test(change)) {
      const question = `When did the ${change.toLowerCase().replace(/\.$/, "")} happen?`;
      if (!questions.includes(question)) questions.push(question);
    }
  }

  // Priority 2: Target carried-forward unknowns
  for (const u of unknowns.prior_unknowns_carried_forward) {
    if (questions.length < 3) {
      const q = u.endsWith("?") ? u : `${u.replace(/\.$/, "")}?`;
      if (!questions.includes(q)) questions.push(q);
    }
  }

  // Priority 3: New unknowns
  for (const u of unknowns.new_unknowns) {
    if (questions.length < 3) {
      if (!questions.includes(u)) questions.push(u);
    }
  }

  // Fallback: one generic orienting question if nothing specific
  if (questions.length === 0 && understanding.can_orient) {
    questions.push("Has anything else changed with the situation?");
  }

  const priority: ReasoningQuestions["priority"] =
    unknowns.remaining_uncertainty === "high"
      ? "must_know"
      : unknowns.remaining_uncertainty === "medium"
        ? "helpful_to_know"
        : "can_wait";

  return {
    targeted_questions: questions.slice(0, 3),
    priority,
  };
}

/**
 * Answer "What evidence exists?" (Question 8)
 * Evaluates supporting, contradictory, and missing evidence.
 */
function reasonEvidence(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningEvidence {
  const supporting: string[] = [];
  const contradictory: string[] = [];
  const missing: string[] = [];

  // Supporting evidence from facts
  for (const fact of understanding.facts) {
    if (fact.kind === "event" || fact.kind === "observation") {
      supporting.push(fact.text);
    }
  }

  // Contradictory evidence from changes and possible links
  for (const change of understanding.changes_from_baseline) {
    if (/\b(?:contradict|conflict|disagree|different|instead|but|however)\b/i.test(change)) {
      contradictory.push(change);
    }
  }

  // Missing evidence from unknowns
  for (const unknown of understanding.unknowns) {
    const clean = unknown.replace(/\?$/, "").trim();
    if (clean.length > 10) {
      missing.push(clean);
    }
  }

  // Determine evidential strength
  let strength: ReasoningEvidence["strength"] = "insufficient";
  if (supporting.length >= 3 && contradictory.length === 0) {
    strength = "strong";
  } else if (supporting.length >= 2) {
    strength = "moderate";
  } else if (supporting.length >= 1) {
    strength = "weak";
  }

  return {
    supporting_evidence: supporting.slice(0, 5),
    contradictory_evidence: contradictory.slice(0, 3),
    missing_evidence: missing.slice(0, 3),
    strength,
  };
}

/**
 * Answer "What relationships exist?" (Question 9)
 * Identifies temporal, contextual, and pattern links between observations.
 */
function reasonRelationships(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningRelationships {
  const temporal: string[] = [];
  const contextual: string[] = [];
  const patterns: string[] = [];

  // Temporal links from possible_links
  for (const link of understanding.possible_links) {
    if (/\b(?:after|before|during|while|then|subsequently|following)\b/i.test(link.text)) {
      temporal.push(link.text);
    } else if (/\b(?:also|and|with|alongside|together)\b/i.test(link.text)) {
      contextual.push(link.text);
    } else {
      patterns.push(link.text);
    }
  }

  // Changes from baseline that suggest patterns
  if (understanding.changes_from_baseline.length >= 2) {
    patterns.push(
      `Multiple changes observed: ${understanding.changes_from_baseline.slice(0, 2).join("; ")}`,
    );
  }

  const hasRelationships =
    temporal.length > 0 || contextual.length > 0 || patterns.length > 0;

  return {
    temporal_links: temporal.slice(0, 3),
    contextual_links: contextual.slice(0, 3),
    pattern_links: patterns.slice(0, 3),
    has_relationships: hasRelationships,
  };
}

/**
 * Answer "What should be remembered?" (Question 10)
 * Decides which facts to commit to memory and which to let decay.
 */
function reasonMemory(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningMemory {
  const remember: string[] = [];
  const doNotRemember: string[] = [];
  const openLoops: string[] = [];

  // Facts worth remembering (events, decisions, outcomes)
  for (const fact of understanding.facts) {
    if (fact.kind === "event" || fact.kind === "decision" || fact.kind === "outcome") {
      remember.push(fact.text);
    } else if (fact.kind === "observation") {
      // Observations are worth remembering if they describe change
      if (understanding.changes_from_baseline.some((c) => fact.text.includes(c.slice(0, 20)))) {
        remember.push(fact.text);
      } else {
        doNotRemember.push(fact.text);
      }
    }
  }

  // Context-only items are not worth remembering
  for (const ctx of understanding.context_only) {
    doNotRemember.push(ctx);
  }

  // Open loops from follow-up questions
  for (const q of understanding.follow_up_questions) {
    openLoops.push(q);
  }

  // Determine memory strategy
  let strategy: ReasoningMemory["strategy"] = "unknown";
  if (remember.length >= 2) {
    strategy = "preserve";
  } else if (remember.length >= 1 && openLoops.length > 0) {
    strategy = "monitor";
  } else if (doNotRemember.length > remember.length) {
    strategy = "let_decay";
  }

  return {
    remember: remember.slice(0, 5),
    do_not_remember: doNotRemember.slice(0, 3),
    open_loops: openLoops.slice(0, 3),
    strategy,
  };
}

/**
 * Answer "What should be monitored?" (Question 11)
 * Identifies things to watch for and escalation triggers.
 */
function reasonMonitor(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningMonitor {
  const watchFor: string[] = [];
  const escalationTriggers: string[] = [];

  // Watch for changes in baseline
  for (const change of understanding.changes_from_baseline) {
    watchFor.push(`Whether ${change.toLowerCase().replace(/\.$/, "")} continues or resolves`);
  }

  // Watch for resolution of unknowns
  for (const unknown of understanding.unknowns) {
    const clean = unknown.replace(/\?$/, "").trim();
    if (clean.length > 10) {
      watchFor.push(`Updates on: ${clean}`);
    }
  }

  // Escalation triggers from safety-critical patterns
  for (const fact of understanding.facts) {
    if (/\b(?:fell|fall|collapse|fainted|seizure|bleed|head)\b/i.test(fact.text)) {
      escalationTriggers.push("Repeat of safety-critical event");
    }
    if (/\b(?:worse|decline|rapid|sudden)\b/i.test(fact.text)) {
      escalationTriggers.push("Rapid decline or sudden change");
    }
  }

  // Determine cadence
  let cadence: ReasoningMonitor["cadence"] = "passive";
  if (escalationTriggers.length > 0 || understanding.changes_from_baseline.length >= 2) {
    cadence = "immediate";
  } else if (watchFor.length >= 2) {
    cadence = "next_update";
  } else if (watchFor.length >= 1) {
    cadence = "periodic";
  }

  return {
    watch_for: watchFor.slice(0, 3),
    escalation_triggers: escalationTriggers.slice(0, 3),
    cadence,
  };
}

/**
 * Answer "What should be revisited later?" (Question 12)
 * Identifies topics to revisit and when.
 */
function reasonRevisit(
  understanding: CareSituationUnderstanding,
  continuityDecision?: ContinuityDecision | null,
): ReasoningRevisit {
  const revisitTopics: string[] = [];

  // Unknowns that need follow-up
  for (const unknown of understanding.unknowns) {
    const clean = unknown.replace(/\?$/, "").trim();
    if (clean.length > 10) {
      revisitTopics.push(clean);
    }
  }

  // Follow-up questions
  for (const q of understanding.follow_up_questions) {
    const clean = q.replace(/\?$/, "").trim();
    if (clean.length > 10 && !revisitTopics.includes(clean)) {
      revisitTopics.push(clean);
    }
  }

  // Continuity hooks
  for (const hook of understanding.continuity_hooks) {
    if (hook.length > 10 && !revisitTopics.includes(hook)) {
      revisitTopics.push(hook);
    }
  }

  // Determine trigger
  let revisitTrigger = "Next caregiver update";
  if (understanding.changes_from_baseline.length > 0) {
    revisitTrigger = "When more information about the change becomes available";
  } else if (understanding.unknowns.length > 0) {
    revisitTrigger = "When the caregiver provides additional context";
  }

  // Determine priority
  let priority: ReasoningRevisit["priority"] = "optional";
  if (revisitTopics.length >= 3) {
    priority = "essential";
  } else if (revisitTopics.length >= 1) {
    priority = "helpful";
  }

  return {
    revisit_topics: revisitTopics.slice(0, 3),
    revisit_trigger: revisitTrigger,
    priority,
  };
}

/**
 * Assert that all 13 reasoning questions have been answered.
 * Throws if any required field is missing or incomplete.
 */
export function assertAllQuestionsAnswered(
  snapshot: CareReasoningSnapshot,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  // Q1: Who
  if (!snapshot.who) failures.push("Q1 (who) is missing");
  if (snapshot.who.certainty === "unknown" && !snapshot.who.needs_confirmation) {
    failures.push("Q1 (who): unknown recipient should require confirmation");
  }

  // Q2: Information type
  if (!snapshot.information_type) failures.push("Q2 (information_type) is missing");

  // Q3: Change
  if (!snapshot.change) failures.push("Q3 (change) is missing");

  // Q4: Priority
  if (!snapshot.priority) failures.push("Q4 (priority) is missing");

  // Q5: Deferral
  if (!snapshot.deferral) failures.push("Q5 (deferral) is missing");

  // Q6: Unknowns
  if (!snapshot.unknowns) failures.push("Q6 (unknowns) is missing");

  // Q7: Questions
  if (!snapshot.questions) failures.push("Q7 (questions) is missing");

  // Q8: Evidence
  if (!snapshot.evidence) failures.push("Q8 (evidence) is missing");
  if (snapshot.evidence && snapshot.evidence.supporting_evidence.length === 0 && snapshot.evidence.strength === "strong") {
    failures.push("Q8 (evidence): strength is strong but no supporting evidence");
  }

  // Q9: Relationships
  if (!snapshot.relationships) failures.push("Q9 (relationships) is missing");

  // Q10: Memory
  if (!snapshot.memory) failures.push("Q10 (memory) is missing");

  // Q11: Monitor
  if (!snapshot.monitor) failures.push("Q11 (monitor) is missing");

  // Q12: Revisit
  if (!snapshot.revisit) failures.push("Q12 (revisit) is missing");

  // Q13: All answered
  if (snapshot.all_questions_answered === undefined) {
    failures.push("Q13 (all_questions_answered) is not set");
  }

  return { ok: failures.length === 0, failures };
}

/**
 * Build the complete CareReasoningSnapshot for one turn.
 *
 * This is the primary entry point — called by the composer before composing
 * the caregiver-facing response. It answers all 13 questions and produces
 * structured reasoning that guides response generation.
 *
 * The snapshot is NOT exposed to the caregiver. It is an internal reasoning
 * artifact that feeds the composer.
 */
export function buildCareReasoning(params: {
  understanding: CareSituationUnderstanding;
  continuityDecision?: ContinuityDecision | null;
}): CareReasoningSnapshot {
  const { understanding, continuityDecision } = params;

  // Question 1: Who is this about?
  const who = reasonWho(understanding, continuityDecision);

  // Question 2: Is this new or continuation?
  const informationType = reasonInformationType(understanding, continuityDecision);

  // Question 3: What changed?
  const change = reasonChange(understanding, continuityDecision);

  // Questions 4 & 5: What matters most? What can wait?
  const { priority, deferral } = reasonPriority(understanding);

  // Question 6: What is unknown?
  const unknowns = reasonUnknowns(understanding, continuityDecision);

  // Question 7: What questions reduce uncertainty?
  const questions = reasonQuestions(unknowns, understanding, continuityDecision);

  // Question 8: What evidence exists?
  const evidence = reasonEvidence(understanding, continuityDecision);

  // Question 9: What relationships exist?
  const relationships = reasonRelationships(understanding, continuityDecision);

  // Question 10: What should be remembered?
  const memory = reasonMemory(understanding, continuityDecision);

  // Question 11: What should be monitored?
  const monitor = reasonMonitor(understanding, continuityDecision);

  // Question 12: What should be revisited later?
  const revisit = reasonRevisit(understanding, continuityDecision);

  // Determine continuity type
  const continuityType = continuityDecision?.continuity_type ?? "new_caregiver";

  // Can we compose? We need at least a recipient or a change to orient from
  const canCompose =
    who.certainty !== "unknown" ||
    change.has_changes ||
    priority.matters_now.length > 0 ||
    understanding.can_orient;

  // Question 13: Are all questions sufficiently answered?
  const assertion = assertAllQuestionsAnswered({
    who,
    information_type: informationType,
    change,
    priority,
    deferral,
    unknowns,
    questions,
    evidence,
    relationships,
    memory,
    monitor,
    revisit,
    all_questions_answered: false,
    continuity_type: continuityType,
    can_compose: canCompose,
  });

  return {
    who,
    information_type: informationType,
    change,
    priority,
    deferral,
    unknowns,
    questions,
    evidence,
    relationships,
    memory,
    monitor,
    revisit,
    all_questions_answered: assertion.ok,
    continuity_type: continuityType,
    can_compose: canCompose,
  };
}
