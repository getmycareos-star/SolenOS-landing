import { CONFIDENCE_GAP_THRESHOLD } from "./contract-constants";

import type {

  ContinuityGap,

  ExpectedFollowUp,

  ObjectConfidence,

  StaleContinuityItem,

} from "./types";



export function deriveStaleItems(objects: ObjectConfidence[]): StaleContinuityItem[] {

  return objects

    .filter((o) => o.confidence_pct < CONFIDENCE_GAP_THRESHOLD)

    .map((o) => ({

      object_id: o.object_id,

      label: o.label,

      tier: o.tier,

      confidence_pct: o.confidence_pct,

      stale_reason: `Last confirmed ${o.age_days}d ago — freshness window ${o.freshness_window_days}d`,

    }))

    .sort((a, b) => a.confidence_pct - b.confidence_pct);

}



export function detectContinuityGaps(input: {

  stale_items: StaleContinuityItem[];

  expected_follow_ups: ExpectedFollowUp[];

  meaningful_silence: boolean;

  days_since_last_update: number;

}): ContinuityGap[] {

  const gaps: ContinuityGap[] = [];



  for (const item of input.stale_items) {

    gaps.push({

      gap_id: `stale_${item.object_id}`,

      label: item.label,

      reason: item.stale_reason,

      source_event_ids: [item.object_id],

      confidence_pct: item.confidence_pct,

      importance: item.tier === "short_lived" ? "high" : item.tier === "medium_lived" ? "medium" : "low",

    });

  }



  for (const followUp of input.expected_follow_ups) {

    if (followUp.confirmed || followUp.overdue_days === null || followUp.overdue_days <= 0) continue;

    gaps.push({

      gap_id: `followup_${followUp.source_event_id}_${followUp.check_after_days}`,

      label: followUp.label,

      reason: `Expected confirmation ${followUp.overdue_days}d overdue — do not assume success`,

      source_event_ids: [followUp.source_event_id],

      confidence_pct: Math.max(20, 60 - followUp.overdue_days * 2),

      importance: followUp.check_after_days <= 2 ? "high" : "medium",

    });

  }



  if (input.meaningful_silence && input.days_since_last_update >= 3) {

    gaps.push({

      gap_id: "silence_gap",

      label: "Update cadence gap",

      reason: `No update in ${input.days_since_last_update}d — relative to this family's typical rhythm, uncertainty is increasing`,

      source_event_ids: [],

      confidence_pct: Math.max(30, 80 - input.days_since_last_update * 3),

      importance: "medium",

    });

  }



  const seen = new Set<string>();

  return gaps.filter((g) => {

    if (seen.has(g.gap_id)) return false;

    seen.add(g.gap_id);

    return true;

  });

}


