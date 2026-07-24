import { REFRESH_QUESTION_TEMPLATES } from "./contract-constants";

import type {

  ContinuityGap,

  ExpectedFollowUp,

  RefreshSession,

  StaleContinuityItem,

} from "./types";



function contextualPrompt(gap: ContinuityGap): string | null {

  const label = gap.label.toLowerCase();

  if (/medication|med|pill/.test(label)) {

    return "Last week you mentioned a medication change — would you like to tell me how that's going?";

  }

  if (/sleep/.test(label)) {

    return "We haven't checked in on sleep recently — has anything changed?";

  }

  if (/fall/.test(label)) {

    return "Has there been any follow-up since the fall was recorded?";

  }

  if (/hospital|discharge/.test(label)) {

    return "Any updates since the hospital or discharge event?";

  }

  return null;

}



export function buildRecheckPrompts(input: {

  gaps: ContinuityGap[];

  overdue_follow_ups: ExpectedFollowUp[];

}): string[] {

  const prompts: string[] = [];



  for (const gap of input.gaps.slice(0, 4)) {

    const contextual = contextualPrompt(gap);

    if (contextual) {

      prompts.push(contextual);

    } else if (gap.importance === "high") {

      prompts.push(`Refresh needed: ${gap.label} — ${gap.reason}`);

    }

  }



  for (const fu of input.overdue_follow_ups.slice(0, 3)) {

    prompts.push(

      `Expected ${fu.label} check is ${fu.overdue_days}d overdue — confirmation not recorded`,

    );

  }



  return [...new Set(prompts)].slice(0, 5);

}



export function buildRefreshSession(input: {

  days_since_last_update: number;

  gaps: ContinuityGap[];

  stale_items: StaleContinuityItem[];

  meaningful_gap: boolean;

}): RefreshSession | null {

  if (!input.meaningful_gap && input.gaps.length === 0) return null;



  const days = Math.round(input.days_since_last_update);

  const welcome =

    days >= 1

      ? `Welcome back. It's been ${days} day${days === 1 ? "" : "s"} since your last update — let's quickly refresh your care situation.`

      : "Let's confirm what still reflects your current care situation.";



  const questions: string[] = [];

  const reasons: string[] = [];



  for (const gap of input.gaps.sort((a, b) => {

    const order = { high: 0, medium: 1, low: 2 };

    return order[a.importance] - order[b.importance];

  })) {

    const contextual = contextualPrompt(gap);

    if (contextual && !questions.includes(contextual)) {

      questions.push(contextual);

      reasons.push(gap.reason);

    }

  }



  for (const template of REFRESH_QUESTION_TEMPLATES) {

    if (questions.length >= 5) break;

    if (!questions.includes(template)) questions.push(template);

  }



  for (const stale of input.stale_items.slice(0, 3)) {

    reasons.push(`${stale.label}: ${stale.stale_reason}`);

  }



  return {

    welcome_message: welcome,

    days_since_last_update: days,

    questions: questions.slice(0, 6),

    decision_trace_reasons: reasons.slice(0, 6),

  };

}



export function buildDecisionTraceReasons(input: {

  gaps: ContinuityGap[];

  refresh_session: RefreshSession | null;

}): string[] {

  const reasons: string[] = [];

  for (const gap of input.gaps.slice(0, 4)) {

    reasons.push(`We're asking because: ${gap.reason}`);

  }

  if (input.refresh_session) {

    reasons.push(...input.refresh_session.decision_trace_reasons.map((r) => `Refresh: ${r}`));

  }

  return [...new Set(reasons)].slice(0, 8);

}


