import type {
  AssessmentSource,
  ClockType,
  DecayRate,
  ItemRiskLevel,
  ItemType,
  PrioritizedItem,
  RecurrenceType,
  ResourcePool,
} from "./types";
import { isCareRecipientWant, isStaticWant } from "./extract-items";

type ClassifyContext = {
  now: Date;
  fullInput: string;
  deprioritizedCounts?: Readonly<Record<string, number>>;
};

function normalizeKey(description: string): string {
  return description.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectAssessmentSource(text: string): AssessmentSource {
  if (/\b(doctor|dentist|electrician|inspector|assessor|verified|confirmed by|professional)\b/i.test(text)) {
    return "professional_verified";
  }
  return "caregiver_reported";
}

function detectRecurrence(text: string): RecurrenceType {
  if (/\b(property taxes?|annual tax|every year|yearly|taxes are due)\b/i.test(text)) return "annual";
  if (/\b(seasonal|winter|spring|summer|fall)\b/i.test(text)) return "seasonal";
  if (/\b(one time|once|already done|resolved)\b/i.test(text)) return "one_time";
  return "unknown";
}

function detectDelegationEligible(text: string): boolean {
  if (/\b(poa|power of attorney|medical authorization|consent form|legal decision)\b/i.test(text)) {
    return false;
  }
  if (/\b(mouse trap|shopping|drive|errand|check on|visit)\b/i.test(text)) {
    return true;
  }
  return false;
}

function classifyDecay(text: string): { type: ItemType; decay_rate: DecayRate | null } {
  if (isStaticWant(text)) {
    return { type: "static", decay_rate: null };
  }

  if (/\b(electrical|exposed wir|sparks?|fire|gas leak|choking|not breathing)\b/i.test(text)) {
    return { type: "decaying", decay_rate: "fast" };
  }
  if (/\b(mice|mouse|rodent|infestation|infection|worsening|unpaid penalty)\b/i.test(text)) {
    return { type: "decaying", decay_rate: "moderate" };
  }
  if (/\b(roof|plumb|leak|structural|damage|deteriorat)\b/i.test(text)) {
    return { type: "decaying", decay_rate: "slow" };
  }
  if (/\b(pain|symptom|health|medical|dental|tooth)\b/i.test(text)) {
    return { type: "decaying", decay_rate: "moderate" };
  }

  if (/\b(property taxes?|taxes due)\b/i.test(text)) {
    return { type: "static", decay_rate: null };
  }

  if (/\b(repair|fix|hazard|unsafe)\b/i.test(text)) {
    return { type: "decaying", decay_rate: "moderate" };
  }

  return { type: "decaying", decay_rate: "slow" };
}

function classifyClock(
  text: string,
  type: ItemType,
  fullInput: string,
): { clock_type: ClockType | null; due_date: string | null; estimated_window: string | null } {
  if (
    type === "static" &&
    !/\b(property taxes?|taxes due|deadline|due date)\b/i.test(text)
  ) {
    return { clock_type: null, due_date: null, estimated_window: null };
  }

  if (/\b(property taxes?|taxes due|tax deadline|due (?:on|by)|deadline|enrollment period)\b/i.test(text)) {
    const dueMatch = fullInput.match(
      /\b(?:due|by)\s+(?:on\s+)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    );
    return {
      clock_type: "deadline_bound",
      due_date: dueMatch ? dueMatch[1]! : null,
      estimated_window: dueMatch ? null : "Has an external due date — confirm the exact date",
    };
  }

  if (/\b(dental follow|follow-up|appointment|post-op)\b/i.test(text)) {
    return {
      clock_type: "deadline_bound",
      due_date: null,
      estimated_window: "Follow-up care window — confirm timing with the care team",
    };
  }

  if (type === "decaying") {
    const rate = classifyDecay(text).decay_rate;
    if (rate === "fast") {
      return {
        clock_type: "consequence_bound",
        due_date: null,
        estimated_window: "Should be addressed within days, not weeks",
      };
    }
    if (rate === "moderate") {
      return {
        clock_type: "consequence_bound",
        due_date: null,
        estimated_window: "Should be addressed within weeks — cost of delay compounds",
      };
    }
    return {
      clock_type: "consequence_bound",
      due_date: null,
      estimated_window: "Can be planned, but delay still adds cost over months",
    };
  }

  return { clock_type: null, due_date: null, estimated_window: null };
}

function classifyPools(text: string, fullInput: string): ResourcePool[] {
  const pools = new Set<ResourcePool>();
  const limitedMoney = /\b(limited money|shared pool|finite money|budget|afford)\b/i.test(fullInput);

  if (
    /\b(money|cost|tax|pay|fund|afford|expensive|budget|financial|denture|repair cost)\b/i.test(text) ||
    (limitedMoney && /\b(electrical|roof|plumb|mice|repair|hazard|denture|tax)\b/i.test(text))
  ) {
    pools.add("money");
  }
  if (/\b(repair|labor|full time|work|hours|DIY|fix ourselves|no backup)\b/i.test(text)) {
    pools.add("caregiver_time");
  }
  if (/\b(grandmother|grandma|presence|time with|visit|shopping|wants to)\b/i.test(text)) {
    pools.add("presence_with_care_recipient");
  }
  if (/\b(stress|overwhelm|guilt|emotional|insurance call|medical call|dentist)\b/i.test(text)) {
    pools.add("emotional_capacity");
  }
  if (/\b(decision|paperwork|insurance|authorize|complex|figure out)\b/i.test(text)) {
    pools.add("cognitive_capacity");
  }

  if (/\b(repair labor|doing repairs ourselves|trades time)\b/i.test(fullInput) && /\b(repair|roof|plumb|electrical)\b/i.test(text)) {
    pools.add("caregiver_time");
    pools.add("presence_with_care_recipient");
  }

  if (pools.size === 0) {
    pools.add("caregiver_time");
  }

  return [...pools];
}

function classifyRisk(text: string, type: ItemType, decay_rate: DecayRate | null): ItemRiskLevel {
  if (type === "static" && !/\b(property tax|taxes)\b/i.test(text)) return "low";
  if (/\b(electrical|fire|exposed wir|sparks?)\b/i.test(text)) return "high";
  if (/\b(mice|infection|unpaid tax|penalty)\b/i.test(text)) return "medium";
  if (decay_rate === "fast") return "high";
  if (decay_rate === "moderate") return "medium";
  return "low";
}

function buildRecheckPrompt(
  item: Pick<PrioritizedItem, "type" | "decay_rate" | "clock_type" | "description">,
): string | null {
  if (item.type !== "decaying" || item.clock_type !== "consequence_bound") return null;
  if (item.decay_rate === "fast") {
    return `Re-check whether "${item.description}" is still live — fast-decay items need confirmation within days.`;
  }
  if (item.decay_rate === "moderate") {
    return `Re-check "${item.description}" within its decay window — unverified caregiver reports may have changed.`;
  }
  return null;
}

function buildAutonomyNote(
  description: string,
  type: ItemType,
  deprioritizedCount: number,
): string | null {
  if (type !== "static" || !isCareRecipientWant(description)) return null;
  if (deprioritizedCount >= 3) {
    return `This has been set aside ${deprioritizedCount} times. It may be worth doing soon for its own sake, not because it's urgent.`;
  }
  if (deprioritizedCount >= 1) {
    return `A care recipient want — deprioritized ${deprioritizedCount} time(s). Agency and dignity matter even when risk is low.`;
  }
  return null;
}

export function classifyItem(
  raw: { id: string; description: string },
  ctx: ClassifyContext,
): PrioritizedItem {
  const text = raw.description;
  const key = normalizeKey(text);
  const { type, decay_rate } = classifyDecay(text);
  const clock = classifyClock(text, type, ctx.fullInput);
  const pool = classifyPools(text, ctx.fullInput);
  const deprioritized_count = ctx.deprioritizedCounts?.[key] ?? (type === "static" ? 0 : 0);

  const assessment_source = detectAssessmentSource(text + " " + ctx.fullInput);
  const risk_level = classifyRisk(text, type, decay_rate);

  const item: PrioritizedItem = {
    id: raw.id,
    description: text,
    type,
    decay_rate,
    clock_type: clock.clock_type,
    due_date: clock.due_date,
    estimated_window: clock.estimated_window,
    pool,
    risk_level,
    assessment_source,
    last_updated: ctx.now.toISOString(),
    recurrence: detectRecurrence(text + " " + ctx.fullInput),
    deprioritized_count,
    delegation_eligible: detectDelegationEligible(text),
    recheck_prompt: null,
    autonomy_note: null,
  };

  item.recheck_prompt = buildRecheckPrompt(item);
  item.autonomy_note = buildAutonomyNote(text, type, deprioritized_count);

  if (assessment_source === "caregiver_reported" && /\b(hazard|electrical|unsafe)\b/i.test(text)) {
    item.recheck_prompt =
      item.recheck_prompt ??
      "Electrical hazard is caregiver-reported — professional verification would change confidence.";
  }

  return item;
}

export function classifyItems(
  items: { id: string; description: string }[],
  ctx: ClassifyContext,
): PrioritizedItem[] {
  return items.map((item) => classifyItem(item, ctx));
}
