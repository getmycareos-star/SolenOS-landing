/**
 * Phase 5.3 — Feedback → load/containment only (not empathy training).
 * Confusion signal → hold Clarity + reduce asks for one interaction turn.
 * Helpful feedback → no disclosure change (avoid engagement hack).
 *
 * SoT: docs/17-canonical-architecture/spine-build-sequence.md Slice 5.3
 */
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import type { ReliefDisclosureDecision } from "../response-contract/relief-decision";
import type { TelemetryFeedbackSubmit } from "./schema";

export type FeedbackContainmentRecord = {
  care_key: string;
  /** One-turn containment after confusion feedback. */
  hold_clarity: boolean;
  max_asks_cap: number;
  reason: "confusion_feedback" | "none";
  set_at: string;
  /** Consumed after one compose/ingest turn applies it. */
  pending: boolean;
};

export type FeedbackContainmentAdaptation = {
  active: boolean;
  hold_clarity: boolean;
  max_asks_cap: number;
  reason: FeedbackContainmentRecord["reason"];
};

const memory = new Map<string, FeedbackContainmentRecord>();

function normalizeCareKey(careKey: string): string {
  return resolveCareRealityStoreKey(careKey.trim());
}

function filePath(careKey: string): string {
  return livingCareRecordDataDir(
    "feedback-containment",
    `${sanitizeDurableCareKey(normalizeCareKey(careKey))}.json`,
  );
}

function emptyRecord(careKey: string): FeedbackContainmentRecord {
  return {
    care_key: careKey,
    hold_clarity: false,
    max_asks_cap: 3,
    reason: "none",
    set_at: new Date().toISOString(),
    pending: false,
  };
}

export function getFeedbackContainmentRecord(
  careKey: string,
): FeedbackContainmentRecord {
  const key = normalizeCareKey(careKey);
  const cached = memory.get(key);
  if (cached) return cached;
  const durable = readDurableJson<FeedbackContainmentRecord>(filePath(key));
  if (durable) {
    memory.set(key, durable);
    return durable;
  }
  return emptyRecord(key);
}

function persist(record: FeedbackContainmentRecord): FeedbackContainmentRecord {
  memory.set(record.care_key, record);
  writeDurableJson(filePath(record.care_key), record);
  return record;
}

/**
 * Confusion feedback only — helpful alone never changes disclosure.
 */
export function shouldApplyFeedbackContainment(
  feedback: Pick<TelemetryFeedbackSubmit, "helpful_yes_no" | "reduced_confusion_yes_no">,
): boolean {
  return feedback.reduced_confusion_yes_no === false;
}

/** Record one-turn containment from POST /api/feedback (requires care_key). */
export function setFeedbackContainmentFromFeedback(params: {
  careKey: string;
  feedback: Pick<TelemetryFeedbackSubmit, "helpful_yes_no" | "reduced_confusion_yes_no">;
  nowIso?: string;
}): FeedbackContainmentRecord | null {
  if (!shouldApplyFeedbackContainment(params.feedback)) {
    return null;
  }
  const key = normalizeCareKey(params.careKey);
  const now = params.nowIso ?? new Date().toISOString();
  return persist({
    care_key: key,
    hold_clarity: true,
    max_asks_cap: 0,
    reason: "confusion_feedback",
    set_at: now,
    pending: true,
  });
}

export function peekFeedbackContainmentAdaptation(
  careKey: string,
): FeedbackContainmentAdaptation {
  const record = getFeedbackContainmentRecord(careKey);
  if (!record.pending || record.reason !== "confusion_feedback") {
    return {
      active: false,
      hold_clarity: false,
      max_asks_cap: 3,
      reason: "none",
    };
  }
  return {
    active: true,
    hold_clarity: record.hold_clarity,
    max_asks_cap: record.max_asks_cap,
    reason: record.reason,
  };
}

/** Apply load/containment only — never copy or empathy templates. */
export function applyFeedbackContainmentToRelief(
  decision: ReliefDisclosureDecision,
  adaptation: FeedbackContainmentAdaptation,
): ReliefDisclosureDecision {
  if (!adaptation.active) return decision;
  const max_asks = Math.min(decision.max_asks, adaptation.max_asks_cap);
  return {
    ...decision,
    show_clarity: adaptation.hold_clarity ? false : decision.show_clarity,
    max_asks,
    show_asks: max_asks > 0 ? decision.show_asks : false,
    show_follow_up: adaptation.hold_clarity ? false : decision.show_follow_up,
  };
}

/** Mark one-turn containment consumed after disclosure applied. */
export function consumeFeedbackContainment(careKey: string): FeedbackContainmentRecord {
  const record = getFeedbackContainmentRecord(careKey);
  if (!record.pending) return record;
  return persist({
    ...record,
    pending: false,
    hold_clarity: false,
    max_asks_cap: 3,
    reason: "none",
    set_at: new Date().toISOString(),
  });
}

export function resetFeedbackContainmentStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("feedback-containment"));
}
