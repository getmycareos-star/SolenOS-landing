import { DEFAULT_SELF_MENTION_WINDOW_DAYS, SELF_NEGLECT_NOTE_TEMPLATE } from "./contract-constants";

const SELF_MENTION =
  /\b(my (?:stress|sleep|health|rest|needs|exhaustion|break|wellbeing|well-being)|I need (?:rest|help|a break|time off)|I'm (?:tired|exhausted|burned out|overwhelmed)|my own (?:health|needs))\b/i;

const CAREGIVER_LOAD_CONTEXT =
  /\b(work(?:s)? full time|no backup|doing repairs|repair labor|limited money|shared pool|caregiver and|I am|I'm the only)\b/i;

export type SelfNeglectResult = {
  self_neglect_flag: boolean;
  days_since_self_mention: number | null;
  self_neglect_note: string | null;
};

export function detectSelfNeglect(params: {
  input: string;
  recentSubmissionTexts?: readonly string[];
  now?: Date;
  windowDays?: number;
}): SelfNeglectResult {
  const now = params.now ?? new Date();
  const windowDays = params.windowDays ?? DEFAULT_SELF_MENTION_WINDOW_DAYS;
  const allTexts = [...(params.recentSubmissionTexts ?? []), params.input];

  let daysSinceSelfMention: number | null = null;
  let foundSelfMention = false;

  if (SELF_MENTION.test(params.input)) {
    return { self_neglect_flag: false, days_since_self_mention: 0, self_neglect_note: null };
  }

  for (let i = allTexts.length - 1; i >= 0; i--) {
    const text = allTexts[i]!;
    if (SELF_MENTION.test(text)) {
      foundSelfMention = true;
      daysSinceSelfMention = allTexts.length - 1 - i;
      break;
    }
  }

  if (!foundSelfMention) {
    const hasLoadContext =
      CAREGIVER_LOAD_CONTEXT.test(params.input) ||
      (params.recentSubmissionTexts ?? []).some((t) => CAREGIVER_LOAD_CONTEXT.test(t));

    if (hasLoadContext || allTexts.length >= 1) {
      daysSinceSelfMention = windowDays + 1;
      const note = SELF_NEGLECT_NOTE_TEMPLATE.replace("{days}", String(daysSinceSelfMention));
      return {
        self_neglect_flag: true,
        days_since_self_mention: daysSinceSelfMention,
        self_neglect_note: note,
      };
    }
  }

  if (foundSelfMention && daysSinceSelfMention !== null && daysSinceSelfMention >= windowDays) {
    const note = SELF_NEGLECT_NOTE_TEMPLATE.replace("{days}", String(daysSinceSelfMention));
    return {
      self_neglect_flag: true,
      days_since_self_mention: daysSinceSelfMention,
      self_neglect_note: note,
    };
  }

  return {
    self_neglect_flag: false,
    days_since_self_mention: foundSelfMention ? 0 : null,
    self_neglect_note: null,
  };
}
