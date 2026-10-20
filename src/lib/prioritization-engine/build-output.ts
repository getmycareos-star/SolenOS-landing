import { PRIORITIZATION_ENGINE_BOUNDARY, STATIC_PARKED_NOTE } from "./contract-constants";
import type {
  PrioritizedItem,
  PrioritizationOutput,
  ResourceTension,
  RiskCascade,
} from "./types";
import type { SelfNeglectResult } from "./self-neglect";

function shortLabel(description: string, max = 56): string {
  const t = description.trim();
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
}

function decayingItems(items: PrioritizedItem[]): PrioritizedItem[] {
  return items.filter((i) => i.type === "decaying");
}

function staticItems(items: PrioritizedItem[]): PrioritizedItem[] {
  return items.filter((i) => i.type === "static");
}

function urgencyRank(item: PrioritizedItem): number {
  let score = 0;
  if (item.type === "decaying") {
    if (item.decay_rate === "fast") score += 100;
    else if (item.decay_rate === "moderate") score += 60;
    else score += 30;
  }
  if (item.clock_type === "consequence_bound" && item.decay_rate === "fast") score += 40;
  if (item.clock_type === "deadline_bound") score += 25;
  if (item.risk_level === "high") score += 30;
  else if (item.risk_level === "medium") score += 15;
  return score;
}

export function buildWhatMattersNow(
  items: PrioritizedItem[],
  cascades: RiskCascade[],
  selfNeglect: SelfNeglectResult,
): string {
  const decaying = [...decayingItems(items)].sort((a, b) => urgencyRank(b) - urgencyRank(a));
  const top = decaying[0];

  if (!top) {
    if (selfNeglect.self_neglect_flag) {
      return `${selfNeglect.self_neglect_note} No single decaying hazard dominates right now — your own absence from the list is the signal worth weighing alongside everything else. ${PRIORITIZATION_ENGINE_BOUNDARY}`;
    }
    return `Clarify which concern has the steepest cost of delay. ${PRIORITIZATION_ENGINE_BOUNDARY}`;
  }

  const cascadeNote = cascades.find(
    (c) => c.item_a === top.id || c.item_b === top.id,
  );

  let text = `${shortLabel(top.description)} carries the fastest consequence clock in this set`;
  if (top.estimated_window) {
    text += ` — ${top.estimated_window.toLowerCase()}`;
  }
  if (top.assessment_source === "caregiver_reported") {
    text += `. This is caregiver-reported; confidence is medium until verified`;
  }
  if (cascadeNote) {
    text += `. ${cascadeNote.compounding_note}`;
  }
  text += `. SolenOS surfaces stakes and timing — you remain the decision maker; this is not a financial, legal, or medical instruction.`;

  return text;
}

export function buildWhatIsHappening(items: PrioritizedItem[], fullInput: string): string {
  const decaying = decayingItems(items);
  const parked = staticItems(items).filter(
    (i) => !/\bproperty tax|taxes/i.test(i.description),
  );

  if (items.length <= 1) {
    return "A caregiving situation is taking shape from what you shared.";
  }

  const domains = decaying.slice(0, 4).map((i) => shortLabel(i.description, 36)).join("; ");
  let text = `Multiple domains are competing at once: ${domains}.`;

  if (/\blimited money|shared pool|finite money\b/i.test(fullInput)) {
    text += " Money is limited and shared across these needs.";
  }
  if (/\brepair labor|ourselves|full time|no backup\b/i.test(fullInput)) {
    text += " Caregiver time is also finite — repair labor trades presence with grandma for money saved.";
  }

  if (parked.length > 0) {
    text += ` ${shortLabel(parked[0]!.description)} is static — ${STATIC_PARKED_NOTE.toLowerCase()}`;
  }

  return text;
}

export function buildWhatCanWait(items: PrioritizedItem[]): string {
  const parked = staticItems(items).filter(
    (i) => !/\bproperty tax|taxes/i.test(i.description),
  );
  const slowDecaying = decayingItems(items).filter(
    (i) => i.decay_rate === "slow" && i.risk_level !== "high",
  );

  const parts: string[] = [];

  for (const item of parked) {
    parts.push(
      `${shortLabel(item.description)} — static; delaying has near-zero cost and it will not escalate on its own`,
    );
  }

  for (const item of slowDecaying.slice(0, 2)) {
    parts.push(
      `${shortLabel(item.description)} — slower decay curve; can be planned after faster clocks are addressed`,
    );
  }

  if (parts.length === 0) {
    return "Non-urgent cosmetic or optional items can be parked once faster-decay hazards are clearer.";
  }

  return `${parts.join(". ")}.`;
}

export function buildFollowUpItems(items: PrioritizedItem[]): string[] {
  const followUps: string[] = [];

  for (const item of items) {
    if (item.assessment_source === "caregiver_reported" && /\b(electrical|hazard|unsafe)\b/i.test(item.description)) {
      followUps.push("Confirm whether the electrical hazard is still live (power on, sparks continuing)");
    }
    if (item.clock_type === "deadline_bound" && !item.due_date) {
      followUps.push(`Exact due date for ${shortLabel(item.description, 32)}`);
    }
    if (item.recheck_prompt) {
      followUps.push(item.recheck_prompt);
    }
  }

  if (items.some((i) => i.recurrence === "annual")) {
    followUps.push("Property tax was due around this time last year — note the cycle for next year");
  }

  const unique = [...new Set(followUps)];
  return unique.slice(0, 5);
}

export function buildPrioritizationOutput(params: {
  items: PrioritizedItem[];
  resource_tension: ResourceTension[];
  risk_cascade: RiskCascade[];
  selfNeglect: SelfNeglectResult;
  fullInput: string;
}): PrioritizationOutput {
  const { items, resource_tension, risk_cascade, selfNeglect, fullInput } = params;

  return {
    what_is_happening: buildWhatIsHappening(items, fullInput),
    items,
    resource_tension,
    risk_cascade,
    what_matters_now: buildWhatMattersNow(items, risk_cascade, selfNeglect),
    what_can_wait: buildWhatCanWait(items),
    self_neglect_flag: selfNeglect.self_neglect_flag,
    days_since_self_mention: selfNeglect.days_since_self_mention,
    self_neglect_note: selfNeglect.self_neglect_note,
    follow_up_items: buildFollowUpItems(items),
  };
}
