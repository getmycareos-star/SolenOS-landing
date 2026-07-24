import {
  MEMORY_DESIGN_PRINCIPLES,
  MEMORY_STRATEGY_DEFINING_PRINCIPLE,
  MEMORY_STRATEGY_IDENTITY,
  MEMORY_TIERS,
} from "./contract-constants";
import {
  classifyEventMemoryTier,
  memoryLabel,
  tierExpiryDays,
  whatWouldInvalidate,
  whyRemembered,
} from "./classify-memory";
import { compressRepetitiveEvents, extractPersonalHints } from "./compression-personal";
import { buildTransitionEvents, detectMemoryConflicts } from "./conflict-resolution";
import {
  detectDemotions,
  detectExpirations,
  detectPromotions,
  detectReinforcements,
} from "./lifecycle";
import {
  buildCurrentStatusSummary,
  prioritizeRetrieval,
} from "./retrieval-summarization";
import { getMemoryRecords, saveMemoryRecords } from "./store";
import type { MemoryRecord, MemoryStrategyResult, ProcessMemoryStrategyInput } from "./types";

function buildRecordFromEvent(event: ProcessMemoryStrategyInput["events_created"][0]): MemoryRecord {
  const tier = classifyEventMemoryTier(event);
  const asOf = event.ingestion_time;
  const expiryDays = tierExpiryDays(tier);
  const expires_at =
    expiryDays !== null
      ? new Date(new Date(asOf).getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const label = memoryLabel(event);
  const baseConfidence = tier === "permanent" ? 90 : tier === "long_lived" ? 75 : tier === "short_lived" ? 65 : 40;

  return {
    id: `mem_${event.id}`,
    source_event_id: event.id,
    label,
    tier,
    confidence_pct: baseConfidence,
    created_at: event.ingestion_time,
    last_confirmed_at: event.status === "committed" ? event.ingestion_time : null,
    expires_at,
    status: tier === "session" ? "active" : "active",
    evidence_event_ids: [event.id],
    why_remembered: whyRemembered(tier, label),
    what_would_invalidate: whatWouldInvalidate(tier),
    promotion_eligible: tier === "short_lived",
  };
}

export function processMemoryStrategy(input: ProcessMemoryStrategyInput): MemoryStrategyResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const prior = getMemoryRecords(input.caregiver_id);

  const newRecords = input.events_created
    .filter((e) => e.status !== "invalidated" && e.status !== "superseded")
    .map(buildRecordFromEvent);

  let records = [...prior, ...newRecords];
  const conflicts = detectMemoryConflicts(input.events_created, prior);
  const transitionFromConflicts = buildTransitionEvents(conflicts);

  const { reinforced, records: afterReinforce } = detectReinforcements(
    input.events_created,
    records,
    asOf,
  );
  records = afterReinforce;

  const { expired, records: afterExpire } = detectExpirations(records, asOf);
  records = afterExpire;

  const { demotions, records: afterDemote } = detectDemotions(input.events_created, records);
  records = afterDemote;

  const { promotions, records: afterPromote } = detectPromotions(input.events_created, records);
  records = afterPromote;

  saveMemoryRecords(input.caregiver_id, records);

  const compressed_trends = compressRepetitiveEvents(input.all_events);
  const personal_memory_hints = extractPersonalHints(input.all_events);
  const current_status_summary = buildCurrentStatusSummary(records);

  const topics = input.events_created.map((e) => e.raw_input.slice(0, 40));
  const retrieval_priority = prioritizeRetrieval(records, topics);

  const tier_counts = MEMORY_TIERS.reduce(
    (acc, tier) => {
      acc[tier] = records.filter((r) => r.tier === tier && r.status === "active").length;
      return acc;
    },
    {} as Record<(typeof MEMORY_TIERS)[number], number>,
  );

  const explainable_facts = records
    .filter((r) => r.status === "active" || r.status === "promoted")
    .slice(-8)
    .map((r) => ({
      label: r.label,
      tier: r.tier,
      confidence_pct: r.confidence_pct,
      why_remembered: r.why_remembered,
      last_confirmed_at: r.last_confirmed_at,
      source_event_ids: r.evidence_event_ids,
    }));

  return {
    active: records.length > 0 || input.all_events.length > 0,
    records_classified: newRecords,
    transitions: [...transitionFromConflicts, ...demotions, ...promotions],
    conflicts,
    promotions: promotions.map((p) => p.memory_id),
    demotions: demotions.map((d) => d.memory_id),
    expirations: expired,
    reinforcements: reinforced,
    compressed_trends,
    current_status_summary,
    personal_memory_hints,
    retrieval_priority,
    explainable_facts,
    tier_counts,
    principles_upheld: [...MEMORY_DESIGN_PRINCIPLES],
    defining_principle: MEMORY_STRATEGY_DEFINING_PRINCIPLE,
  };
}

export { MEMORY_STRATEGY_IDENTITY };
