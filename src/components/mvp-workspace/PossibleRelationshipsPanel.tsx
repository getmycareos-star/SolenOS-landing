"use client";

import { useEffect, useMemo, useState } from "react";
import { getJSON, postJSON } from "@/api/client";

type PersistedPattern = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  pattern_type: string;
  pattern_strength: string;
  event_ids: string[];
  change_ids?: string[] | null;
  temporal_start: string;
  temporal_end: string;
  evidence_count: number;
  confidence?: number | null;
  alternative_interpretations?: unknown[] | null;
  pattern_metrics?: Record<string, unknown> | null;
  is_active: boolean;
  superseded_by_pattern_id?: string | null;
};

type PatternEvent = {
  id: string;
  event_type: string;
  status: string;
  occurred_at?: string | null;
  recorded_at?: string | null;
  title: string;
  description?: string | null;
  evidence_ids: string[];
  time_provenance?: string | null;
  contributor_id?: string | null;
  contributor_label?: string | null;
};

type PatternEvidenceReview = {
  id: string;
  evidence_id: string;
  review_type: string;
  outcome: string;
  rationale: string;
  policy_version: string;
  reviewed_at?: string | null;
  reviewed_by_caregiver_id?: string | null;
};

type PatternChange = {
  id: string;
  change_type: string;
  change_direction: string;
  previous_state?: string | null;
  current_state?: string | null;
  explanation?: string | null;
  evidence_ids: string[];
  confirmation_status: string;
};

type PatternDetail = {
  pattern: PersistedPattern;
  events: PatternEvent[];
  changes: PatternChange[];
  evidence_reviews: PatternEvidenceReview[];
};

type PatternCard = {
  pattern: PersistedPattern;
  events: PatternEvent[];
  changes: PatternChange[];
  evidenceReviews: PatternEvidenceReview[];
  error?: string;
};

type PatternReviewDecision = {
  id: string;
  person_id: string;
  target_type: string;
  target_id: string;
  review_decision: string;
  reason?: string | null;
  reviewed_by_caregiver_id?: string | null;
  created_at?: string | null;
};

function formatWhen(value?: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time not recorded"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function elapsedBetween(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  const minutes = Math.round((b - a) / 60000);
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours
    ? `${days} day(s), ${remainingHours} hour(s)`
    : days === 1 ? "1 day" : `${days} days`;
}

function interpretationText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    const text = [item.description, item.interpretation, item.rationale, item.note]
      .find((entry) => typeof entry === "string" && entry.trim());
    return typeof text === "string" ? text : JSON.stringify(value);
  }
  return String(value);
}

function isEligibleEvent(event: PatternEvent): boolean {
  return !["invalidated", "superseded", "retracted", "deleted"].includes(
    (event.status || "").toLowerCase(),
  );
}

function isMeaningfulPattern(pattern: PersistedPattern, events: PatternEvent[]): boolean {
  const eligible = events.filter(isEligibleEvent);
  const eventTimes = new Set(
    eligible.map((event) => event.occurred_at).filter((value): value is string => Boolean(value)),
  );
  return pattern.is_active
    && !pattern.superseded_by_pattern_id
    && !["weak", "none"].includes(pattern.pattern_strength.toLowerCase())
    && eligible.length >= 2
    && eventTimes.size >= 2
    && pattern.evidence_count >= 2;
}

function relationshipStatus(pattern: PersistedPattern, events: PatternEvent[]): string {
  if (!pattern.is_active || pattern.superseded_by_pattern_id) {
    return "Relationship no longer supported by current evidence";
  }
  const eligibleEvents = events.filter(isEligibleEvent);
  if (events.length > 0 && eligibleEvents.length < 2 && events.some((event) => !isEligibleEvent(event))) {
    return "Relationship no longer supported by current evidence";
  }
  if (!isMeaningfulPattern(pattern, events)) return "Insufficient evidence";
  if (
    ["recurrence", "clustering"].includes(pattern.pattern_type)
    && events.filter(isEligibleEvent).length >= 3
  ) {
    return "Repeated association observed";
  }
  return "Possible relationship";
}

export default function PossibleRelationshipsPanel({
  personId,
  patterns,
  patternsError,
}: {
  personId: string;
  patterns: PersistedPattern[];
  patternsError?: string | null;
}) {
  const [cards, setCards] = useState<PatternCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reviewDecisions, setReviewDecisions] = useState<PatternReviewDecision[]>([]);
  const [reviewError, setReviewError] = useState("");
  const [feedbackReasons, setFeedbackReasons] = useState<Record<string, string>>({});
  const [feedbackErrors, setFeedbackErrors] = useState<Record<string, string>>({});
  const [savingFeedbackId, setSavingFeedbackId] = useState<string | null>(null);

  const candidatePatterns = useMemo(
    () => patterns.filter((pattern) => pattern.event_ids?.length >= 2).slice(0, 20),
    [patterns],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadDetails() {
      if (!personId || candidatePatterns.length === 0) {
        setCards([]);
        setLoadError("");
        return;
      }
      setLoading(true);
      setLoadError("");
      const results = await Promise.all(candidatePatterns.map(async (pattern): Promise<PatternCard> => {
        try {
          const detail = await getJSON(
            `/change/patterns/${encodeURIComponent(personId)}/${encodeURIComponent(pattern.id)}`,
          ) as PatternDetail;
          if (
            !detail?.pattern
            || detail.pattern.id !== pattern.id
            || detail.pattern.person_id !== personId
            || !Array.isArray(detail.events)
            || !Array.isArray(detail.changes)
            || !Array.isArray(detail.evidence_reviews)
            || detail.events.some((event) => !pattern.event_ids.includes(event.id))
          ) {
            throw new Error("The pattern detail did not match this care record and its persisted source references.");
          }
          return {
            pattern: detail.pattern,
            events: [...detail.events].sort((a, b) => {
              const left = a.occurred_at ? new Date(a.occurred_at).getTime() : Number.POSITIVE_INFINITY;
              const right = b.occurred_at ? new Date(b.occurred_at).getTime() : Number.POSITIVE_INFINITY;
              return left - right;
            }),
            changes: detail.changes,
            evidenceReviews: detail.evidence_reviews,
          };
        } catch (cause) {
          return {
            pattern,
            events: [],
            changes: [],
            evidenceReviews: [],
            error: cause instanceof Error ? cause.message : "Supporting observations could not be loaded.",
          };
        }
      }));
      if (!cancelled) {
        setCards(results);
        setLoadError(results.some((item) => item.error) ? "Some supporting observations could not be loaded. They are not treated as evidence." : "");
        setLoading(false);
      }
    }
    void loadDetails();
    return () => { cancelled = true; };
  }, [personId, candidatePatterns]);

  useEffect(() => {
    let cancelled = false;
    async function loadReviewDecisions() {
      if (!personId) {
        setReviewDecisions([]);
        setReviewError("");
        return;
      }
      try {
        const rows = await getJSON("/care-continuity/review-decisions?limit=100");
        if (!Array.isArray(rows) || rows.some((row) => row?.person_id !== personId)) {
          throw new Error("Review decisions did not match the authenticated care record.");
        }
        if (!cancelled) {
          setReviewDecisions(rows.filter((row) => row.target_type === "pattern") as PatternReviewDecision[]);
          setReviewError("");
        }
      } catch {
        if (!cancelled) {
          setReviewDecisions([]);
          setReviewError("Caregiver review history could not be loaded. Existing decisions are not assumed to be absent.");
        }
      }
    }
    void loadReviewDecisions();
    return () => { cancelled = true; };
  }, [personId]);

  async function submitReviewDecision(pattern: PersistedPattern, decision: "disputed" | "not_applicable") {
    const reason = (feedbackReasons[pattern.id] || "").trim();
    if (reason.length < 5) {
      setFeedbackErrors((current) => ({ ...current, [pattern.id]: "Add a short reason so this review is attributable and understandable." }));
      return;
    }
    setSavingFeedbackId(pattern.id);
    setFeedbackErrors((current) => ({ ...current, [pattern.id]: "" }));
    try {
      const saved = await postJSON("/care-continuity/review-decisions", {
        target_type: "pattern",
        target_id: pattern.id,
        review_decision: decision,
        reason,
      }) as PatternReviewDecision;
      if (
        !saved
        || saved.person_id !== personId
        || saved.target_type !== "pattern"
        || saved.target_id !== pattern.id
        || saved.review_decision !== decision
        || !saved.reviewed_by_caregiver_id
      ) {
        throw new Error("The server did not confirm the person-scoped review decision.");
      }
      setReviewDecisions((current) => [saved, ...current]);
      setFeedbackReasons((current) => ({ ...current, [pattern.id]: "" }));
    } catch (cause) {
      setFeedbackErrors((current) => ({
        ...current,
        [pattern.id]: cause instanceof Error ? cause.message : "Caregiver review could not be saved.",
      }));
    } finally {
      setSavingFeedbackId(null);
    }
  }

  const meaningful = cards.filter((card) => isMeaningfulPattern(card.pattern, card.events));
  const historical = cards.filter((card) => !card.pattern.is_active || Boolean(card.pattern.superseded_by_pattern_id));
  const withheld = cards.filter((card) => !historical.includes(card) && !meaningful.includes(card));

  return (
    <section className="lcr-situation-assessment" aria-labelledby="lcr-possible-relationships-heading">
      <div className="lcr-entry-heading">
        <h3 id="lcr-possible-relationships-heading">Possible Relationships</h3>
        <span>{meaningful.length} supported pattern(s) in loaded history</span>
      </div>
      <p>
        This section surfaces repeated patterns already persisted in the care record. Timing and co-occurrence can make observations worth reviewing, but neither establishes that one event caused another.
      </p>
      {patternsError && (
        <p role="status">Persisted patterns could not be loaded: {patternsError}. No relationship is inferred from unavailable data.</p>
      )}
      {loadError && <p role="status">{loadError}</p>}
      {reviewError && <p role="status">{reviewError}</p>}
      {loading && <p role="status">Loading the original observations linked to persisted patterns…</p>}
      {!loading && !patternsError && meaningful.length === 0 && (
        <p className="lcr-entry-status">Not enough evidence to identify a meaningful relationship.</p>
      )}
      {meaningful.map(({ pattern, events, changes, evidenceReviews, error }) => {
        const eligibleEvents = events.filter(isEligibleEvent);
        const first = eligibleEvents[0];
        const last = eligibleEvents[eligibleEvents.length - 1];
        const elapsed = first && last ? elapsedBetween(first.occurred_at, last.occurred_at) : null;
        const alternatives = pattern.alternative_interpretations || [];
        const contestedReviews = evidenceReviews.filter((review) =>
          ["contested", "conflicting"].includes(review.outcome.toLowerCase()),
        );
        return (
          <article key={pattern.id} className="lcr-current-fact">
            <div className="lcr-entry-heading">
              <strong>{pattern.subject_type.replaceAll("_", " ")} · {pattern.pattern_type.replaceAll("_", " ")}</strong>
              <span>{relationshipStatus(pattern, events)}</span>
            </div>
            <p>
              {eligibleEvents.length} eligible source observation(s) are linked to this persisted pattern, covering {formatWhen(pattern.temporal_start)} to {formatWhen(pattern.temporal_end)}.
              {elapsed ? ` The first and last linked observations are ${elapsed} apart.` : " The elapsed time between observations cannot be calculated from the returned timestamps."}
            </p>
            <p className="lcr-entry-status">
              Why it appears: the persisted pattern assessment classified these records as {pattern.pattern_type.replaceAll("_", " ")}. This describes the recorded observations; it does not establish a clinical explanation or causal link.
            </p>
            {pattern.confidence == null && (
              <p className="lcr-entry-status">No calibrated confidence value is available. No numeric confidence is asserted.</p>
            )}
            {alternatives.length > 0 ? (
              <div>
                <strong>Other possible explanations and limitations</strong>
                <ul>
                  {alternatives.map((item, index) => <li key={index}>{interpretationText(item)}</li>)}
                </ul>
              </div>
            ) : (
              <p className="lcr-entry-status">No alternative interpretation is stored with this pattern. Other explanations have not been ruled out.</p>
            )}
            <p className="lcr-entry-status">
              Evidence limitation: this persisted pattern links observations of the same recorded subject/type. It does not establish a relationship across different care domains. Review the source reports and any conflicts before drawing conclusions.
            </p>
            {contestedReviews.length > 0 ? (
              <p role="status" className="lcr-entry-status">
                Conflicting or contested source reviews exist for {contestedReviews.length} linked evidence item(s). Review the evidence IDs and reviewer rationales below; the conflict is not resolved by this pattern.
              </p>
            ) : (
              <p className="lcr-entry-status">
                Evidence review coverage: {evidenceReviews.length} persisted review record(s) returned. No review record does not mean the source is verified or uncontested.
              </p>
            )}
            <p className="lcr-entry-status">
              Have additional source-backed information? <a href="#lcr-clarification-workflow">Open the existing clarification workflow</a>. A clarification remains a separate review item; it does not confirm this relationship.
            </p>
            {reviewDecisions.filter((review) => review.target_id === pattern.id).slice(0, 1).map((review) => (
              <p key={review.id} className="lcr-entry-status">
                Caregiver review: {review.review_decision.replaceAll("_", " ")} · reviewed {formatWhen(review.created_at)} · caregiver {review.reviewed_by_caregiver_id || "not attributed"}.
                {review.reason ? ` Reason: ${review.reason}` : ""}
                This review is separate from the pattern and does not establish or erase an observation.
              </p>
            ))}
            <div className="lcr-entry-status">
              <label>
                <span>If you want to review this pattern, add a reason</span>
                <textarea
                  value={feedbackReasons[pattern.id] || ""}
                  onChange={(event) => setFeedbackReasons((current) => ({ ...current, [pattern.id]: event.target.value }))}
                  rows={2}
                  maxLength={1000}
                  style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", minHeight: 64, marginTop: 6, border: "1px solid var(--solenos-hairline)", borderRadius: 8, padding: 10, font: "inherit" }}
                  placeholder="What information supports your review?"
                  aria-label={`Reason for reviewing pattern ${pattern.id}`}
                />
              </label>
              <div className="lcr-entry-heading">
                <button type="button" className="lcr-text-action" style={{ minHeight: 40, padding: "8px 12px", border: "1px solid var(--solenos-hairline)", borderRadius: 8, background: "white", color: "inherit" }} onClick={() => void submitReviewDecision(pattern, "not_applicable")} disabled={savingFeedbackId === pattern.id}>
                  {savingFeedbackId === pattern.id ? "Saving review…" : "Not applicable"}
                </button>
                <button type="button" className="lcr-text-action" style={{ minHeight: 40, padding: "8px 12px", border: "1px solid var(--solenos-hairline)", borderRadius: 8, background: "white", color: "inherit" }} onClick={() => void submitReviewDecision(pattern, "disputed")} disabled={savingFeedbackId === pattern.id}>
                  Dispute
                </button>
              </div>
              {feedbackErrors[pattern.id] && <p role="alert">{feedbackErrors[pattern.id]}</p>}
              {reviewError && <p role="status">{reviewError}</p>}
              <small>Reviews are appended with the authenticated caregiver identity. They do not change the pattern, source observations, baseline, or care facts.</small>
            </div>
            <details>
              <summary>Inspect supporting observations ({eligibleEvents.length})</summary>
              {error ? (
                <p role="status">Supporting observations unavailable: {error}</p>
              ) : (
                <div>
                  <ul>
                    {events.map((event) => (
                      <li key={event.id}>
                        <strong>{event.title || event.event_type.replaceAll("_", " ")}</strong>
                        <p>{event.description || "No additional description was recorded."}</p>
                        <small>Observation ID: {event.id} · Source type: {event.event_type.replaceAll("_", " ")} · Status: {event.status}</small>
                        <small>Event time: {formatWhen(event.occurred_at)} · Record-entry time: {formatWhen(event.recorded_at)}</small>
                        <small>Time provenance: {event.time_provenance || "Not recorded"} · Contributor: {event.contributor_label || (event.contributor_id ? `caregiver record ${event.contributor_id}` : "Not recorded")}</small>
                        <small>Evidence references: {event.evidence_ids.length ? event.evidence_ids.join(", ") : "None linked"}</small>
                        <a href={`/workspace/timeline?event_id=${encodeURIComponent(event.id)}`}>Open original observation in Longitudinal Care History</a>
                        {!isEligibleEvent(event) && <small>This source event is no longer eligible to support the active pattern.</small>}
                      </li>
                    ))}
                  </ul>
                  {events.flatMap((event) => event.evidence_ids).length > 0 && (
                    <div>
                      <strong>Evidence review history</strong>
                      {evidenceReviews.length > 0 ? (
                        <ul>{evidenceReviews.map((review) => (
                          <li key={review.id}>
                            Evidence {review.evidence_id} · {review.review_type.replaceAll("_", " ")}: {review.outcome.replaceAll("_", " ")}
                            <p>{review.rationale}</p>
                            <small>Policy {review.policy_version} · Reviewed {formatWhen(review.reviewed_at)} · Caregiver {review.reviewed_by_caregiver_id || "not attributed"}</small>
                          </li>
                        ))}</ul>
                      ) : (
                        <p>No persisted evidence review is linked to the returned source references. This is unknown review status, not confirmation.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {changes.length > 0 && (
                <div>
                  <strong>Linked persisted changes</strong>
                  <ul>{changes.map((change) => (
                    <li key={change.id}>
                      {change.change_type.replaceAll("_", " ")} · {change.change_direction.replaceAll("_", " ")} · {change.confirmation_status.replaceAll("_", " ")}
                      {change.explanation && <p>{change.explanation}</p>}
                      <small>Change ID: {change.id} · Evidence: {change.evidence_ids.length ? change.evidence_ids.join(", ") : "None linked"}</small>
                    </li>
                  ))}</ul>
                </div>
              )}
            </details>
          </article>
        );
      })}
      {withheld.length > 0 && (
        <details>
          <summary>Patterns not shown as meaningful relationships ({withheld.length})</summary>
          <ul>
            {withheld.map(({ pattern, events }) => (
              <li key={pattern.id}>
                {pattern.subject_type.replaceAll("_", " ")} · {pattern.pattern_type.replaceAll("_", " ")} — {relationshipStatus(pattern, events)}.
                {pattern.alternative_interpretations?.length
                  ? ` Recorded limitation: ${pattern.alternative_interpretations.map(interpretationText).join(" ")}`
                  : " No alternative interpretation is stored; other explanations have not been ruled out."}
              </li>
            ))}
          </ul>
        </details>
      )}
      {historical.length > 0 && (
        <details>
          <summary>Historical or superseded patterns ({historical.length})</summary>
          <ul>
            {historical.map(({ pattern }) => (
              <li key={pattern.id}>
                {pattern.subject_type.replaceAll("_", " ")} · {pattern.pattern_type.replaceAll("_", " ")} — Relationship no longer supported by current evidence.
                {pattern.superseded_by_pattern_id && <small> Superseded by pattern {pattern.superseded_by_pattern_id}.</small>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="lcr-footer-note">
        These are read-only interpretations of persisted patterns. They do not modify observations, baselines, care actions, attention status, or the authoritative care record. Community content is not used as evidence here.
      </p>
    </section>
  );
}
