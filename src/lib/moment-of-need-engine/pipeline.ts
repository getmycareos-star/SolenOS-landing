import {
  CHANGE_TYPE_LABELS,
  HELPLESSNESS_REDUCTION_GOAL,
  MOMENT_OF_NEED_DEFINING_PRINCIPLE,
  MOMENT_OF_NEED_RULES,
  MOMENT_TRIGGER_PATTERNS,
  TRACKING_QUESTIONS,
} from "./contract-constants";
import type { ChangeType, MomentOfNeedSections, ProcessMomentOfNeedInput } from "./types";

function shouldTrigger(input: ProcessMomentOfNeedInput): { triggered: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const text = input.raw_input.trim();

  if (text.length < 10) return { triggered: false, reasons: [] };

  if (input.events_created.length > 0) {
    reasons.push("New CareEvent from current observation");
  }

  for (const pattern of MOMENT_TRIGGER_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push("Real-time observation language detected");
      break;
    }
  }

  if ((input.baseline?.deviations.length ?? 0) > 0) {
    reasons.push("Deviation from person-specific baseline");
  }

  return { triggered: reasons.length > 0, reasons };
}

function inferChangeType(input: ProcessMomentOfNeedInput): ChangeType {
  const deviation = input.baseline?.deviations[0];
  if (!deviation) return "new_observation";
  if (deviation.deviation_type === "escalation") return "escalation";
  if (deviation.deviation_type === "return") return "return_of_previous";
  if (deviation.deviation_type === "pattern_shift") return "repeated_pattern";
  return "new_observation";
}

function buildSections(input: ProcessMomentOfNeedInput, changeType: ChangeType): MomentOfNeedSections {
  const sections: MomentOfNeedSections = {
    what_changed: [],
    what_we_know: [],
    possible_context: [],
    questions_worth_tracking: [],
  };

  const changeLabel = CHANGE_TYPE_LABELS[changeType];
  if (input.events_created.length > 0) {
    sections.what_changed.push(
      `${changeLabel}: ${input.events_created[0]!.raw_input.slice(0, 120)}`,
    );
  } else if (input.raw_input.trim()) {
    sections.what_changed.push(`${changeLabel}: ${input.raw_input.trim().slice(0, 120)}`);
  }

  for (const deviation of input.baseline?.deviations ?? []) {
    if (deviation.is_unusual_for_person) {
      sections.what_changed.push(
        `Unusual for this person: ${deviation.observation.slice(0, 100)} (${deviation.compared_to_baseline})`,
      );
    }
  }

  for (const line of input.care_context_diff?.diff.sections.factual_delta ?? []) {
    sections.what_changed.push(line);
  }

  for (const fact of input.baseline?.baseline_facts ?? []) {
    sections.what_we_know.push(
      `Baseline (${fact.domain.replace(/_/g, " ")}): ${fact.label} — ${fact.observation_count} prior observation(s)`,
    );
  }

  for (const entry of input.care_reality_profile?.profile.sections.known_changes ?? []) {
    sections.what_we_know.push(`Prior change recorded: ${entry.label}`);
  }

  for (const entry of input.care_reality_profile?.profile.sections.what_helped ?? []) {
    sections.what_we_know.push(`Previously helped: ${entry.label}`);
  }

  for (const pattern of input.behavior?.longitudinal_patterns ?? []) {
    sections.what_we_know.push(`Historical pattern: ${pattern.label}`);
  }

  const medEvents = input.all_events.filter((e) =>
    /\b(medication|med|dose|prescription)\b/i.test(e.raw_input),
  );
  if (medEvents.length > 0) {
    const recent = medEvents[medEvents.length - 1]!;
    sections.possible_context.push(
      `Medication context: ${recent.raw_input.slice(0, 100)} — may be useful to discuss with care team`,
    );
  }

  for (const insight of input.care_reality_profile?.profile.relationship_insights ?? []) {
    sections.possible_context.push(insight);
  }

  for (const hypothesis of input.behavior?.hypotheses.slice(0, 2) ?? []) {
    sections.possible_context.push(
      `Possible context (${hypothesis.confidence} confidence): ${hypothesis.interpretation} — ${hypothesis.uncertainty_note}`,
    );
  }

  if (sections.possible_context.length === 0) {
    sections.possible_context.push(
      "Insufficient linked context — add prior observations to strengthen understanding",
    );
  }

  for (const item of input.behavior?.investigation_checklist.slice(0, 3) ?? []) {
    sections.questions_worth_tracking.push(item.item);
  }

  for (const q of TRACKING_QUESTIONS) {
    if (sections.questions_worth_tracking.length >= 5) break;
    if (!sections.questions_worth_tracking.includes(q)) {
      sections.questions_worth_tracking.push(q);
    }
  }

  for (const u of input.what_is_uncertain.slice(0, 2)) {
    sections.questions_worth_tracking.push(`Clarify: ${u}`);
  }

  return sections;
}

export function processMomentOfNeed(input: ProcessMomentOfNeedInput): import("./types").MomentOfNeedResult {
  const { triggered, reasons } = shouldTrigger(input);
  const asOf = input.as_of ?? new Date().toISOString();

  if (!triggered) {
    return {
      active: false,
      triggered: false,
      trigger_reasons: [],
      sections: {
        what_changed: [],
        what_we_know: [],
        possible_context: [],
        questions_worth_tracking: [],
      },
      change_type: null,
      helplessness_reduction_goal: HELPLESSNESS_REDUCTION_GOAL,
      human_support: [],
      confidence: "low",
      data_freshness: asOf,
      rules_upheld: [...MOMENT_OF_NEED_RULES],
      defining_principle: MOMENT_OF_NEED_DEFINING_PRINCIPLE,
    };
  }

  const changeType = inferChangeType(input);
  const sections = buildSections(input, changeType);

  const human_support: import("./types").HumanSupportSignal[] = [];
  if (input.what_is_uncertain.length > 0) {
    human_support.push({
      kind: "uncertainty",
      message: `${input.what_is_uncertain.length} area(s) remain uncertain — evidence is incomplete`,
    });
  }
  if (input.behavior?.escalation.escalation_recommended) {
    human_support.push({
      kind: "human_help",
      message: "Safety signals detected — consider reaching out to care team or support network",
    });
  } else {
    human_support.push({
      kind: "clarity",
      message: "Observation connected to existing care context — review sections below",
    });
  }

  const confidence =
    (input.baseline?.baseline_established && sections.what_we_know.length >= 2)
      ? "high"
      : sections.what_we_know.length >= 1
        ? "medium"
        : "low";

  return {
    active: true,
    triggered: true,
    trigger_reasons: reasons,
    sections,
    change_type: changeType,
    helplessness_reduction_goal: HELPLESSNESS_REDUCTION_GOAL,
    human_support,
    confidence,
    data_freshness: asOf,
    rules_upheld: [...MOMENT_OF_NEED_RULES],
    defining_principle: MOMENT_OF_NEED_DEFINING_PRINCIPLE,
  };
}

export { MOMENT_OF_NEED_IDENTITY, HELPLESSNESS_REDUCTION_GOAL } from "./contract-constants";
