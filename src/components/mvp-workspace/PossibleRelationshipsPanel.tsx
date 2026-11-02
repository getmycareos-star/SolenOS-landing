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
  reviewed_at?: string | null;
};

type PersistedTemporalLink = {
  id: string;
  person_id: string;
  event_a_id?: string | null;
  event_b_id?: string | null;
  relationship_type: string;
  time_difference_seconds?: string | null;
  confidence?: number | null;
  evidence_ids?: string[] | null;
  created_at?: string | null;
};

type PersistedEvidenceRelationship = {
  id: string;
  person_id: string;
  source_evidence_id: string;
  related_evidence_id: string;
  relationship_type: string;
  scope_type: string;
  scope_id?: string | null;
  source_independence_status: string;
  origin_group_key?: string | null;
  rationale: string;
  reviewed_by_caregiver_id?: string | null;
  created_at?: string | null;
};

type EvidenceLinkedEvent = {
  id: string;
  title: string;
  event_type: string;
  occurred_at?: string | null;
  recorded_at?: string | null;
  evidence_ids: string[];
  contributor_id?: string | null;
  contributor_label?: string | null;
};

type CareEventRecord = PatternEvent & {
  person_id: string;
  created_by_caregiver_id?: string | null;
};

type TemporalPair = {
  link: PersistedTemporalLink;
  eventA: CareEventRecord;
  eventB: CareEventRecord;
  sequence: string;
  elapsed: string;
};

type TemporalGroup = {
  key: string;
  eventTypeA: string;
  eventTypeB: string;
  relationshipType: string;
  pairs: TemporalPair[];
};

function formatDurationSeconds(seconds: number): string {
  const totalMinutes = Math.round(Math.abs(seconds) / 60);
  if (totalMinutes < 60) return totalMinutes === 1 ? "1 minute" : `${totalMinutes} minutes`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours
    ? `${days} day(s), ${remainingHours} hour(s)`
    : days === 1 ? "1 day" : `${days} days`;
}

function evidenceRelationshipLabel(value: string): string {
  const labels: Record<string, string> = {
    same_origin: "Same origin",
    copied_from: "Copied from",
    forwarded_from: "Forwarded from",
    derived_from: "Derived from",
    corroborates: "Corroborates",
    corroboration_attempt_failed: "Corroboration attempt failed",
    contradicts: "Contradicts",
    duplicates: "Duplicate source",
    related_to: "Related source",
  };
  return labels[value] || value.replaceAll("_", " ");
}

function expectedTemporalType(seconds: number): string {
  if (Math.abs(seconds) < 3600) return "simultaneous";
  if (seconds > 0) {
    if (seconds < 86400) return "followed_shortly_after";
    if (seconds < 604800) return "followed_within_week";
    return "followed_later";
  }
  if (Math.abs(seconds) < 86400) return "preceded_shortly_before";
  if (Math.abs(seconds) < 604800) return "preceded_within_week";
  return "preceded_earlier";
}

function temporalSequence(link: PersistedTemporalLink, eventA: CareEventRecord, eventB: CareEventRecord): TemporalPair | null {
  if (!eventA.occurred_at || !eventB.occurred_at) return null;
  const a = new Date(eventA.occurred_at).getTime();
  const b = new Date(eventB.occurred_at).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const seconds = (b - a) / 1000;
  if (expectedTemporalType(seconds) !== link.relationship_type) return null;
  const sequence = Math.abs(seconds) < 3600
    ? "The two events were recorded within an hour of one another."
    : seconds > 0
      ? "The first event occurred before the second."
      : "The second event occurred before the first.";
  return { link, eventA, eventB, sequence, elapsed: formatDurationSeconds(seconds) };
}


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
  const [temporalLinks, setTemporalLinks] = useState<PersistedTemporalLink[]>([]);
  const [temporalEvents, setTemporalEvents] = useState<CareEventRecord[]>([]);
  const [temporalError, setTemporalError] = useState("");
  const [temporalLoading, setTemporalLoading] = useState(true);
  const [evidenceRelationships, setEvidenceRelationships] = useState<PersistedEvidenceRelationship[]>([]);
  const [evidenceRelationshipError, setEvidenceRelationshipError] = useState("");
  const [evidenceRelationshipsLoading, setEvidenceRelationshipsLoading] = useState(true);

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
    async function loadTemporalContext() {
      if (!personId) {
        setTemporalLinks([]);
        setTemporalEvents([]);
        setTemporalError("");
        setTemporalLoading(false);
        return;
      }
      setTemporalLoading(true);
      try {
        const [links, eventRows] = await Promise.all([
          getJSON("/care-continuity/temporal-relationships?limit=100"),
          getJSON("/care-continuity/events?limit=100"),
        ]);
        if (
          !Array.isArray(links)
          || !Array.isArray(eventRows)
          || links.some((row) => row?.person_id !== personId)
          || eventRows.some((row) => row?.person_id !== personId)
        ) {
          throw new Error("Temporal relationships or source events did not match the authenticated care record.");
        }
        if (!cancelled) {
          setTemporalLinks(links as PersistedTemporalLink[]);
          setTemporalEvents(eventRows.map((event) => ({
            ...event,
            evidence_ids: Array.isArray(event.evidence_ids) ? event.evidence_ids : [],
            contributor_id: event.created_by_caregiver_id || null,
          })) as CareEventRecord[]);
          setTemporalError("");
          setTemporalLoading(false);
        }
      } catch (cause) {
        if (!cancelled) {
          setTemporalLinks([]);
          setTemporalEvents([]);
          setTemporalError(cause instanceof Error ? cause.message : "Persisted temporal context could not be loaded.");
          setTemporalLoading(false);
        }
      }
    }
    void loadTemporalContext();
    return () => { cancelled = true; };
  }, [personId]);

  useEffect(() => {
    let cancelled = false;
    async function loadEvidenceRelationships() {
      if (!personId) {
        setEvidenceRelationships([]);
        setEvidenceRelationshipError("");
        setEvidenceRelationshipsLoading(false);
        return;
      }
      setEvidenceRelationshipsLoading(true);
      try {
        const rows = await getJSON("/care-continuity/evidence-source-relationships?limit=100");
        if (!Array.isArray(rows) || rows.some((row) => row?.person_id !== personId)) {
          throw new Error("Evidence relationships did not match the authenticated care record.");
        }
        if (!cancelled) {
          setEvidenceRelationships(rows as PersistedEvidenceRelationship[]);
          setEvidenceRelationshipError("");
          setEvidenceRelationshipsLoading(false);
        }
      } catch (cause) {
        if (!cancelled) {
          setEvidenceRelationships([]);
          setEvidenceRelationshipError(cause instanceof Error ? cause.message : "Persisted evidence relationships could not be loaded.");
          setEvidenceRelationshipsLoading(false);
        }
      }
    }
    void loadEvidenceRelationships();
    return () => { cancelled = true; };
  }, [personId]);

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
          setReviewDecisions(rows.filter((row) => ["pattern", "temporal_relationship", "evidence_source_relationship"].includes(row.target_type)) as PatternReviewDecision[]);
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

  async function submitReviewTarget(targetType: "pattern" | "temporal_relationship" | "evidence_source_relationship", targetId: string, decision: "disputed" | "not_applicable") {
    const reason = (feedbackReasons[targetId] || "").trim();
    if (reason.length < 5) {
      setFeedbackErrors((current) => ({ ...current, [targetId]: "Add a short reason so this review is attributable and understandable." }));
      return;
    }
    setSavingFeedbackId(targetId);
    setFeedbackErrors((current) => ({ ...current, [targetId]: "" }));
    try {
      const saved = await postJSON("/care-continuity/review-decisions", {
        target_type: targetType,
        target_id: targetId,
        review_decision: decision,
        reason,
      }) as PatternReviewDecision;
      if (
        !saved
        || saved.person_id !== personId
        || saved.target_type !== targetType
        || saved.target_id !== targetId
        || saved.review_decision !== decision
        || !saved.reviewed_by_caregiver_id
      ) {
        throw new Error("The server did not confirm the person-scoped review decision.");
      }
      setReviewDecisions((current) => [saved, ...current]);
      setFeedbackReasons((current) => ({ ...current, [targetId]: "" }));
    } catch (cause) {
      setFeedbackErrors((current) => ({
        ...current,
        [targetId]: cause instanceof Error ? cause.message : "Caregiver review could not be saved.",
      }));
    } finally {
      setSavingFeedbackId(null);
    }
  }

  const temporalContext = useMemo(() => {
    const eventsById = new Map(temporalEvents.map((event) => [event.id, event]));
    const grouped = new Map<string, TemporalGroup>();
    let unresolved = 0;
    const seenPairs = new Set<string>();
    for (const link of temporalLinks) {
      if (!link.event_a_id || !link.event_b_id) {
        unresolved += 1;
        continue;
      }
      const eventA = eventsById.get(link.event_a_id);
      const eventB = eventsById.get(link.event_b_id);
      if (!eventA || !eventB || eventA.id === eventB.id || !isEligibleEvent(eventA) || !isEligibleEvent(eventB)) {
        unresolved += 1;
        continue;
      }
      const pair = temporalSequence(link, eventA, eventB);
      if (!pair) {
        unresolved += 1;
        continue;
      }
      const pairKey = [eventA.id, eventB.id].sort().join(":");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      const key = [eventA.event_type, eventB.event_type, link.relationship_type].join("|");
      const current = grouped.get(key) || {
        key,
        eventTypeA: eventA.event_type,
        eventTypeB: eventB.event_type,
        relationshipType: link.relationship_type,
        pairs: [],
      };
      current.pairs.push(pair);
      grouped.set(key, current);
    }
    return {
      groups: [...grouped.values()].sort((a, b) => b.pairs.length - a.pairs.length),
      unresolved,
    };
  }, [temporalLinks, temporalEvents]);

  const temporalGroups = temporalContext.groups;
  const unresolvedTemporalCount = temporalContext.unresolved;
  const eventsByEvidenceId = useMemo(() => {
    const eventsById = new Map<string, EvidenceLinkedEvent>();
    for (const event of [
      ...temporalEvents,
      ...cards.flatMap((card) => card.events),
    ]) {
      eventsById.set(event.id, event);
    }
    const index = new Map<string, EvidenceLinkedEvent[]>();
    for (const event of eventsById.values()) {
      for (const evidenceId of event.evidence_ids || []) {
        const current = index.get(evidenceId) || [];
        if (!current.some((item) => item.id === event.id)) current.push(event);
        index.set(evidenceId, current);
      }
    }
    return index;
  }, [temporalEvents, cards]);
  const meaningfulTemporalGroups = temporalGroups.filter((group) => group.pairs.length >= 2);
  const isolatedTemporalGroups = temporalGroups.filter((group) => group.pairs.length === 1);
  const meaningful = cards.filter((card) => isMeaningfulPattern(card.pattern, card.events));
  const historical = cards.filter((card) => !card.pattern.is_active || Boolean(card.pattern.superseded_by_pattern_id));
  const withheld = cards.filter((card) => !historical.includes(card) && !meaningful.includes(card));

  return (
    <section className="lcr-situation-assessment" aria-labelledby="lcr-possible-relationships-heading">
      <div className="lcr-entry-heading">
        <h3 id="lcr-possible-relationships-heading">Possible Relationships</h3>
        <span>{meaningful.length + meaningfulTemporalGroups.length} repeated pattern(s) in loaded history</span>
      </div>
      <p>
        This section surfaces persisted observation patterns and authenticated temporal sequences. Timing and co-occurrence can make records worth reviewing, but neither establishes that one event caused another.
      </p>
      {patternsError && (
        <p role="status">Persisted patterns could not be loaded: {patternsError}. No relationship is inferred from unavailable data.</p>
      )}
      {loadError && <p role="status">{loadError}</p>}
      {reviewError && <p role="status">{reviewError}</p>}
      {loading && <p role="status">Loading the original observations linked to persisted patterns…</p>}
      {patterns.length > candidatePatterns.length && <p className="lcr-entry-status">Pattern detail review is bounded to the first 20 persisted patterns with at least two linked events. Additional patterns have not been evaluated in this view.</p>}
      {(temporalLinks.length >= 100 || temporalEvents.length >= 100) && <p className="lcr-entry-status">Temporal context is bounded to the latest 100 links and 100 events returned by the authenticated record API. Older history may not be represented here.</p>}
      {temporalLoading && <p role="status">Loading authenticated temporal links and their original events…</p>}
      {evidenceRelationshipsLoading && <p role="status">Loading caregiver-reviewed source relationships…</p>}
      {temporalError && <p role="status">Temporal sequence context could not be loaded: {temporalError}. No temporal relationship is inferred from unavailable data.</p>}
      {unresolvedTemporalCount > 0 && <p className="lcr-entry-status">{unresolvedTemporalCount} persisted temporal link(s) could not be matched to current, timestamped source events and were not surfaced.</p>}
      {!loading && !temporalLoading && !patternsError && !loadError && !temporalError && !evidenceRelationshipError && !evidenceRelationshipsLoading && meaningful.length === 0 && meaningfulTemporalGroups.length === 0 && (
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
            {reviewDecisions.filter((review) => review.target_type === "pattern" && review.target_id === pattern.id).slice(0, 1).map((review) => (
              <p key={review.id} className="lcr-entry-status">
                Caregiver review: {review.review_decision.replaceAll("_", " ")} · reviewed {formatWhen(review.reviewed_at || review.created_at)} · caregiver {review.reviewed_by_caregiver_id || "not attributed"}.
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
                <button type="button" className="lcr-text-action" style={{ minHeight: 40, padding: "8px 12px", border: "1px solid var(--solenos-hairline)", borderRadius: 8, background: "white", color: "inherit" }} onClick={() => void submitReviewTarget("pattern", pattern.id, "not_applicable")} disabled={savingFeedbackId === pattern.id}>
                  {savingFeedbackId === pattern.id ? "Saving review…" : "Not applicable"}
                </button>
                <button type="button" className="lcr-text-action" style={{ minHeight: 40, padding: "8px 12px", border: "1px solid var(--solenos-hairline)", borderRadius: 8, background: "white", color: "inherit" }} onClick={() => void submitReviewTarget("pattern", pattern.id, "disputed")} disabled={savingFeedbackId === pattern.id}>
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
      {evidenceRelationshipError && <p role="status">Persisted evidence relationships could not be loaded: {evidenceRelationshipError}. No evidence relationship is inferred from unavailable data.</p>}
      {evidenceRelationships.length > 0 && (
        <div>
          <h4>Recorded Evidence Relationships</h4>
          <p>These are explicit, caregiver-attributed source relationships already stored in the record. Their type and source-independence assessment are shown as recorded; neither proves a clinical explanation.</p>
          {evidenceRelationships.map((relationship) => {
            const sourceEvents = eventsByEvidenceId.get(relationship.source_evidence_id) || [];
            const relatedEvents = eventsByEvidenceId.get(relationship.related_evidence_id) || [];
            const priorReview = reviewDecisions.filter((review) =>
              review.target_type === "evidence_source_relationship" && review.target_id === relationship.id,
            ).slice(0, 1)[0];
            return (
              <article key={relationship.id} className="lcr-current-fact">
                <div className="lcr-entry-heading">
                  <strong>{evidenceRelationshipLabel(relationship.relationship_type)}</strong>
                  <span>{relationship.relationship_type === "contradicts" ? "Contradictory source relationship recorded" : "Caregiver-reviewed source relationship"}</span>
                </div>
                <p>
                  Evidence {relationship.source_evidence_id} {evidenceRelationshipLabel(relationship.relationship_type).toLowerCase()} evidence {relationship.related_evidence_id}.
                </p>
                <p>{relationship.rationale}</p>
                <p className="lcr-entry-status">
                  Source independence: {relationship.source_independence_status.replaceAll("_", " ")} · Scope: {relationship.scope_type.replaceAll("_", " ")}{relationship.scope_id ? ` · ${relationship.scope_id}` : ""}{relationship.origin_group_key ? ` · Origin group ${relationship.origin_group_key}` : ""}.
                </p>
                <p className="lcr-entry-status">
                  Recorded {formatWhen(relationship.created_at)} · Reviewer caregiver {relationship.reviewed_by_caregiver_id || "not attributed"}.
                </p>
                {relationship.relationship_type === "contradicts" && (
                  <p role="status" className="lcr-entry-status">
                    This relationship explicitly records a contradiction between source items. The disagreement is preserved; this section does not resolve which source is correct.
                  </p>
                )}
                <div>
                  <strong>Linked source observations</strong>
                  {sourceEvents.length + relatedEvents.length > 0 ? (
                    <ul>
                      {[...sourceEvents, ...relatedEvents].filter((event, index, all) => all.findIndex((item) => item.id === event.id) === index).map((event) => (
                        <li key={event.id}>
                          {event.title} · event {formatWhen(event.occurred_at)} · recorded {formatWhen(event.recorded_at)} · contributor {event.contributor_label || event.contributor_id || "not recorded"}
                          <p><a href={`/workspace/timeline?event_id=${encodeURIComponent(event.id)}`}>Open source observation</a></p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No event link was returned for these evidence items. This relationship remains at source-evidence level.</p>
                  )}
                </div>
                <p className="lcr-entry-status">
                  Alternative interpretations: this record stores the source relationship and rationale, but not a separate alternative-interpretation assessment. Inspect both source items and their evidence reviews; shared origin or coincidence may affect how the relationship should be read.
                </p>
                {priorReview && (
                  <p className="lcr-entry-status">
                    Caregiver review: {priorReview.review_decision.replaceAll("_", " ")} · {formatWhen(priorReview.reviewed_at || priorReview.created_at)} · caregiver {priorReview.reviewed_by_caregiver_id || "not attributed"}. {priorReview.reason || ""}
                  </p>
                )}
                <label>
                  <span>Review this evidence relationship</span>
                  <textarea
                    value={feedbackReasons[relationship.id] || ""}
                    onChange={(event) => setFeedbackReasons((current) => ({ ...current, [relationship.id]: event.target.value }))}
                    rows={2}
                    maxLength={1000}
                    style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", minHeight: 64, marginTop: 6, border: "1px solid var(--solenos-hairline)", borderRadius: 8, padding: 10, font: "inherit" }}
                    aria-label={`Reason for reviewing evidence relationship ${relationship.id}`}
                    placeholder="What information supports your review?"
                  />
                </label>
                <div className="lcr-entry-heading">
                  <button type="button" className="lcr-text-action" style={{ minHeight: 40, padding: "8px 12px", border: "1px solid var(--solenos-hairline)", borderRadius: 8, background: "white", color: "inherit" }} onClick={() => void submitReviewTarget("evidence_source_relationship", relationship.id, "not_applicable")} disabled={savingFeedbackId === relationship.id}>Not applicable</button>
                  <button type="button" className="lcr-text-action" style={{ minHeight: 40, padding: "8px 12px", border: "1px solid var(--solenos-hairline)", borderRadius: 8, background: "white", color: "inherit" }} onClick={() => void submitReviewTarget("evidence_source_relationship", relationship.id, "disputed")} disabled={savingFeedbackId === relationship.id}>Dispute</button>
                </div>
                {feedbackErrors[relationship.id] && <p role="alert">{feedbackErrors[relationship.id]}</p>}
              </article>
            );
          })}
        </div>
      )}
      {evidenceRelationships.length >= 100 && <p className="lcr-entry-status">Evidence relationship history is bounded to the latest 100 records returned by the authenticated care API.</p>}
      {meaningfulTemporalGroups.map((group) => (
        <article key={group.key} className="lcr-current-fact">
          <div className="lcr-entry-heading">
            <strong>{group.eventTypeA.replaceAll("_", " ")} + {group.eventTypeB.replaceAll("_", " ")}</strong>
            <span>Repeated temporal sequence observed</span>
          </div>
          <p>
            {group.pairs.length} distinct persisted event pair(s) show the same recorded sequence category. This is a repeated timing pattern only; it does not establish that either event caused or clinically explains the other.
          </p>
          <p className="lcr-entry-status">
            Alternative interpretations: no record-specific alternative interpretation is stored for these temporal links. Coincidence, shared circumstances, incomplete capture, or imprecise event times remain possible and have not been assessed.
          </p>
          <p className="lcr-entry-status">The temporal-link confidence field is not used as a calibrated probability. Sequence is recalculated from the current event timestamps before display.</p>
          <p className="lcr-entry-status">The temporal-link record does not retain a creator or its own review status. It is treated only as a stored timestamp calculation; source-event attribution and evidence reviews remain the relevant record.</p>
          <details>
            <summary>Inspect source event pairs ({group.pairs.length})</summary>
            <ul>
              {group.pairs.map(({ link, eventA, eventB, sequence, elapsed }) => (
                <li key={link.id}>
                  <strong>{sequence} Time between events: {elapsed}.</strong>
                  <p>{eventA.title} — {formatWhen(eventA.occurred_at)} · recorded {formatWhen(eventA.recorded_at)}</p>
                  <small>Source event {eventA.id} · {eventA.event_type.replaceAll("_", " ")} · contributor {eventA.created_by_caregiver_id || "not recorded"} · evidence {eventA.evidence_ids.length ? eventA.evidence_ids.join(", ") : "none linked"}</small>
                  <a href={`/workspace/timeline?event_id=${encodeURIComponent(eventA.id)}`}>Open first source observation</a>
                  <p>{eventB.title} — {formatWhen(eventB.occurred_at)} · recorded {formatWhen(eventB.recorded_at)}</p>
                  <small>Source event {eventB.id} · {eventB.event_type.replaceAll("_", " ")} · contributor {eventB.created_by_caregiver_id || "not recorded"} · evidence {eventB.evidence_ids.length ? eventB.evidence_ids.join(", ") : "none linked"}</small>
                  <a href={`/workspace/timeline?event_id=${encodeURIComponent(eventB.id)}`}>Open second source observation</a>
                  <small>Temporal link ID: {link.id} · calculated {formatWhen(link.created_at)}</small>
                  {reviewDecisions.filter((review) => review.target_type === "temporal_relationship" && review.target_id === link.id).slice(0, 1).map((review) => (
                    <p key={review.id} className="lcr-entry-status">
                      Caregiver review: {review.review_decision.replaceAll("_", " ")} · {formatWhen(review.created_at)} · caregiver {review.reviewed_by_caregiver_id || "not attributed"}. {review.reason || ""}
                    </p>
                  ))}
                  <label>
                    <span>Review this temporal sequence</span>
                    <textarea
                      value={feedbackReasons[link.id] || ""}
                      onChange={(event) => setFeedbackReasons((current) => ({ ...current, [link.id]: event.target.value }))}
                      rows={2}
                      maxLength={1000}
                      style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", minHeight: 64, marginTop: 6, border: "1px solid var(--solenos-hairline)", borderRadius: 8, padding: 10, font: "inherit" }}
                      aria-label={`Reason for reviewing temporal sequence ${link.id}`}
                      placeholder="What information supports your review?"
                    />
                  </label>
                  <div className="lcr-entry-heading">
                    <button type="button" className="lcr-text-action" style={{ minHeight: 40, padding: "8px 12px", border: "1px solid var(--solenos-hairline)", borderRadius: 8, background: "white", color: "inherit" }} onClick={() => void submitReviewTarget("temporal_relationship", link.id, "not_applicable")} disabled={savingFeedbackId === link.id}>Not applicable</button>
                    <button type="button" className="lcr-text-action" style={{ minHeight: 40, padding: "8px 12px", border: "1px solid var(--solenos-hairline)", borderRadius: 8, background: "white", color: "inherit" }} onClick={() => void submitReviewTarget("temporal_relationship", link.id, "disputed")} disabled={savingFeedbackId === link.id}>Dispute</button>
                  </div>
                  {feedbackErrors[link.id] && <p role="alert">{feedbackErrors[link.id]}</p>}
                </li>
              ))}
            </ul>
          </details>
        </article>
      ))}
      {isolatedTemporalGroups.length > 0 && (
        <details>
          <summary>Single temporal sequences — insufficient evidence ({isolatedTemporalGroups.length})</summary>
          <ul>
            {isolatedTemporalGroups.map((group) => {
              const pair = group.pairs[0];
              return (
                <li key={group.key}>
                  {group.eventTypeA.replaceAll("_", " ")} + {group.eventTypeB.replaceAll("_", " ")}: {pair.sequence} This is one recorded sequence, not a repeated relationship. Not enough evidence to identify a meaningful relationship.
                </li>
              );
            })}
          </ul>
        </details>
      )}
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
        These are read-only interpretations of persisted patterns and authenticated temporal records. They do not modify observations, baselines, care actions, attention status, or the authoritative care record. Temporal sequence is not causation. Community content is not used as evidence here.
      </p>
    </section>
  );
}
