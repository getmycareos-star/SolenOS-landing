/**
 * Slice 5.6 — Retention hypothesis instrumentation (ops / research only).
 *
 * Four MVP research questions — never a caregiver survey wall, never engagement hacks.
 * Proxies from Living Care Record behavior: orientation, return, explainability, change-return.
 *
 * SoT: docs/02-product/solenos-mvp-research-validation.md
 * Spine: docs/17-canonical-architecture/spine-build-sequence.md Slice 5.6
 *
 * Quiet post-session micro-prompt UI = FUTURE (requires ADR) — not shipped here.
 */
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
  listDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { RESEARCH_RETENTION_HYPOTHESIS } from "./contract-constants";

/** Structural compose fields — avoid circular import with caregiver-response-composer. */
export type RetentionComposeSnapshot = {
  confirmation?: string | null;
  what_changed?: string | null;
  situation_summary?: string | null;
  what_we_know?: readonly string[] | null;
  what_matters_now?: string | null;
  still_unclear?: readonly string[] | null;
  connection_note?: string | null;
};

export type RetentionHypothesisId = (typeof RESEARCH_RETENTION_HYPOTHESIS)[number];

export type RetentionProxySignals = {
  /** Q1 — understand what is happening better */
  understand_better: boolean;
  /** Q2 — less afraid of forgetting something important */
  less_fear_of_forgetting: boolean;
  /** Q3 — can explain the situation better to another person */
  can_explain_better: boolean;
  /** Q4 — would use again when something changes */
  would_return_on_change: boolean;
};

export type RetentionResearchEvent = {
  care_key: string;
  recorded_at: string;
  week_key: string;
  signals: RetentionProxySignals;
  /** Opaque source tags for ops — never caregiver UI. */
  evidence_tags: string[];
  turn_class?: string | null;
  is_return?: boolean;
  relation?: string | null;
};

export type RetentionResearchStore = {
  care_key: string;
  events: RetentionResearchEvent[];
  updated_at: string;
};

/** Weekly cohort rollup — ops/research only; never caregiver-visible scores. */
export type WeeklyRetentionCohortMetrics = {
  week_key: string;
  cohort_care_keys: number;
  event_count: number;
  /** Share of events with positive proxy for each hypothesis (0–1). */
  rates: Record<RetentionHypothesisId, number>;
  /** Care keys with ≥1 positive signal for each hypothesis this week. */
  care_keys_positive: Record<RetentionHypothesisId, number>;
  /** Ops-only — not a product scoreboard. */
  ops_only: true;
  no_caregiver_survey: true;
};

const memory = new Map<string, RetentionResearchStore>();

function filePath(careKey: string): string {
  return livingCareRecordDataDir(
    "retention-research",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

/** ISO week key YYYY-Www (UTC) for cohort bucketing. */
export function weekKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return weekKeyFromIso(new Date().toISOString());
  }
  // ISO week: Thursday-based year
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function emptyStore(careKey: string): RetentionResearchStore {
  return {
    care_key: careKey,
    events: [],
    updated_at: new Date().toISOString(),
  };
}

export function getRetentionResearchStore(careKey: string): RetentionResearchStore {
  const key = careKey.trim();
  const cached = memory.get(key);
  if (cached) return cached;
  const durable = readDurableJson<RetentionResearchStore>(filePath(key));
  if (durable?.events) {
    memory.set(key, durable);
    return durable;
  }
  return emptyStore(key);
}

function persist(store: RetentionResearchStore): RetentionResearchStore {
  memory.set(store.care_key, store);
  writeDurableJson(filePath(store.care_key), store);
  return store;
}

/**
 * Derive research proxies from composed orientation + session context.
 * Conservative: missing evidence → false (unknown), never invent survey answers.
 */
export function deriveRetentionProxySignals(params: {
  composed: RetentionComposeSnapshot;
  careWorthyCount: number;
  isReturn?: boolean;
  relation?: string | null;
  helpfulFeedback?: boolean | null;
  reducedConfusion?: boolean | null;
  hasDecisionWhy?: boolean;
}): { signals: RetentionProxySignals; evidence_tags: string[] } {
  const tags: string[] = [];
  const composed = params.composed;
  const oriented =
    Boolean(composed.what_changed?.trim()) ||
    Boolean(composed.situation_summary?.trim()) ||
    (composed.what_we_know?.length ?? 0) > 0;
  if (oriented) tags.push("orientation_surface");

  const understand_better =
    oriented ||
    params.reducedConfusion === true ||
    params.helpfulFeedback === true;
  if (params.reducedConfusion === true) tags.push("reduced_confusion_feedback");
  if (params.helpfulFeedback === true) tags.push("helpful_feedback");

  const less_fear_of_forgetting =
    params.careWorthyCount >= 1 &&
    (Boolean(composed.confirmation?.trim()) ||
      Boolean(composed.connection_note?.trim()) ||
      params.isReturn === true);
  if (params.careWorthyCount >= 1) tags.push("care_held");
  if (params.isReturn) tags.push("return_visit");

  const can_explain_better =
    (composed.what_we_know?.length ?? 0) >= 1 ||
    Boolean(composed.situation_summary?.trim()) ||
    Boolean(composed.what_matters_now?.trim()) ||
    params.hasDecisionWhy === true;
  if (params.hasDecisionWhy) tags.push("decision_why");
  if ((composed.what_we_know?.length ?? 0) >= 1) tags.push("held_facts");

  const changeRelation =
    params.relation === "updates_active" ||
    params.relation === "adds_context" ||
    params.relation === "answers_uncertainty";
  const would_return_on_change =
    (params.isReturn === true && (oriented || changeRelation)) ||
    (changeRelation && params.careWorthyCount >= 2);
  if (changeRelation) tags.push("change_update");

  return {
    signals: {
      understand_better,
      less_fear_of_forgetting,
      can_explain_better,
      would_return_on_change,
    },
    evidence_tags: tags,
  };
}

/** Record one ops research event — never surfaces in caregiver UI. */
export function recordRetentionResearchEvent(params: {
  careKey: string;
  composed: RetentionComposeSnapshot;
  careWorthyCount: number;
  isReturn?: boolean;
  relation?: string | null;
  turnClass?: string | null;
  helpfulFeedback?: boolean | null;
  reducedConfusion?: boolean | null;
  hasDecisionWhy?: boolean;
  nowIso?: string;
}): RetentionResearchEvent {
  const now = params.nowIso ?? new Date().toISOString();
  const careKey = params.careKey.trim();
  const { signals, evidence_tags } = deriveRetentionProxySignals({
    composed: params.composed,
    careWorthyCount: params.careWorthyCount,
    isReturn: params.isReturn,
    relation: params.relation,
    helpfulFeedback: params.helpfulFeedback,
    reducedConfusion: params.reducedConfusion,
    hasDecisionWhy: params.hasDecisionWhy,
  });

  const event: RetentionResearchEvent = {
    care_key: careKey,
    recorded_at: now,
    week_key: weekKeyFromIso(now),
    signals,
    evidence_tags,
    turn_class: params.turnClass ?? null,
    is_return: params.isReturn ?? false,
    relation: params.relation ?? null,
  };

  const store = getRetentionResearchStore(careKey);
  const next: RetentionResearchStore = {
    care_key: careKey,
    events: [...store.events, event].slice(-200),
    updated_at: now,
  };
  persist(next);
  return event;
}

function listAllStores(): RetentionResearchStore[] {
  const dir = livingCareRecordDataDir("retention-research");
  for (const name of listDurableDirectory(dir)) {
    if (!name.endsWith(".json")) continue;
    const careKey = name.replace(/\.json$/, "");
    if (!memory.has(careKey)) {
      getRetentionResearchStore(careKey);
    }
  }
  return [...memory.values()];
}

/**
 * Weekly cohort metrics for MVP research — ops only.
 * Answers whether proxies for the four hypothesis questions are present in the cohort.
 */
export function aggregateWeeklyRetentionCohortMetrics(params?: {
  weekKey?: string;
  nowIso?: string;
}): WeeklyRetentionCohortMetrics {
  const week =
    params?.weekKey ??
    weekKeyFromIso(params?.nowIso ?? new Date().toISOString());
  const stores = listAllStores();
  const careKeys = new Set<string>();
  const events: RetentionResearchEvent[] = [];
  const positiveKeys: Record<RetentionHypothesisId, Set<string>> = {
    understand_what_is_happening_better: new Set(),
    less_afraid_of_forgetting_something_important: new Set(),
    can_explain_the_situation_better_to_another_person: new Set(),
    would_use_again_when_something_changes: new Set(),
  };

  const signalForHypothesis = (
    s: RetentionProxySignals,
    id: RetentionHypothesisId,
  ): boolean => {
    switch (id) {
      case "understand_what_is_happening_better":
        return s.understand_better;
      case "less_afraid_of_forgetting_something_important":
        return s.less_fear_of_forgetting;
      case "can_explain_the_situation_better_to_another_person":
        return s.can_explain_better;
      case "would_use_again_when_something_changes":
        return s.would_return_on_change;
      default:
        return false;
    }
  };

  let positiveEventCounts: Record<RetentionHypothesisId, number> = {
    understand_what_is_happening_better: 0,
    less_afraid_of_forgetting_something_important: 0,
    can_explain_the_situation_better_to_another_person: 0,
    would_use_again_when_something_changes: 0,
  };

  for (const store of stores) {
    for (const ev of store.events) {
      if (ev.week_key !== week) continue;
      careKeys.add(ev.care_key);
      events.push(ev);
      for (const id of RESEARCH_RETENTION_HYPOTHESIS) {
        if (signalForHypothesis(ev.signals, id)) {
          positiveEventCounts[id] += 1;
          positiveKeys[id].add(ev.care_key);
        }
      }
    }
  }

  const n = events.length;
  const rates = {} as Record<RetentionHypothesisId, number>;
  const care_keys_positive = {} as Record<RetentionHypothesisId, number>;
  for (const id of RESEARCH_RETENTION_HYPOTHESIS) {
    rates[id] = n === 0 ? 0 : positiveEventCounts[id] / n;
    care_keys_positive[id] = positiveKeys[id].size;
  }

  return {
    week_key: week,
    cohort_care_keys: careKeys.size,
    event_count: n,
    rates,
    care_keys_positive,
    ops_only: true,
    no_caregiver_survey: true,
  };
}

export function resetRetentionResearchStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("retention-research"));
}

/**
 * Fold relief feedback into the latest research event for this care key.
 * Ops only — never creates a caregiver survey surface.
 */
export function attachFeedbackToRetentionResearch(params: {
  careKey: string;
  helpfulFeedback: boolean;
  reducedConfusion: boolean;
  nowIso?: string;
}): RetentionResearchEvent | null {
  const store = getRetentionResearchStore(params.careKey);
  if (store.events.length === 0) return null;
  const last = store.events[store.events.length - 1]!;
  const tags = new Set(last.evidence_tags);
  if (params.helpfulFeedback) tags.add("helpful_feedback");
  if (params.reducedConfusion) tags.add("reduced_confusion_feedback");
  const signals: RetentionProxySignals = {
    ...last.signals,
    understand_better:
      last.signals.understand_better ||
      params.helpfulFeedback ||
      params.reducedConfusion,
  };
  const updated: RetentionResearchEvent = {
    ...last,
    signals,
    evidence_tags: [...tags],
    recorded_at: params.nowIso ?? last.recorded_at,
  };
  const events = [...store.events.slice(0, -1), updated];
  persist({
    care_key: store.care_key,
    events,
    updated_at: params.nowIso ?? new Date().toISOString(),
  });
  return updated;
}

/** FUTURE — quiet post-session micro-prompt requires ADR; never ship survey wall. */
export const RETENTION_MICRO_PROMPT_STATUS = "FUTURE_REQUIRES_ADR" as const;
