"use client";

import { useEffect, useState } from "react";
import { postJSON } from "@/api/client";

type AssistResult = {
  reply?: string;
  claim_provenance?: {
    claims?: Array<{
      claim_id: string;
      text: string;
      support_status: string;
      aggregate?: { count?: number; window_label?: string } | null;
      aggregate_review?: { count?: number | null; interpretation_limit?: string } | null;
      source_references: Array<{
        label?: string;
        occurred_at?: string | null;
        recorded_at?: string | null;
        entered_by?: string | null;
        reported_by?: string | null;
        source_excerpt?: string | null;
        related_evidence?: Array<{
          label?: string;
          reported_by?: string | null;
          entered_by?: string | null;
          recorded_at?: string | null;
          source_excerpt?: string | null;
          observations?: Array<{
            label?: string;
            attribute?: string;
            value?: string | null;
            occurred_at?: string | null;
            reported_by?: string | null;
            source_excerpt?: string | null;
          }>;
        }>;
      }>;
    }>;
  };
  ai_generated?: boolean;
  review_required?: boolean;
  written_to_lcr?: boolean;
  persistence?: string;
  source_event_ids?: string[];
  source_evidence_ids?: string[];
};

type State =
  | { status: "loading" }
  | { status: "ready"; result: AssistResult }
  | { status: "unavailable" };

/**
 * Adds a model-generated interpretation beside the authoritative LCR projection.
 * It is requested only after the backend confirms that a care event was saved.
 * Qwen output is read-only assistance; the structured LCR cards remain canonical.
 */
export function LcrQwenInterpretation({
  rawInput,
  sourceEventId,
}: {
  rawInput: string;
  sourceEventId: string | null;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!sourceEventId || !rawInput.trim()) return;

    let cancelled = false;
    setState({ status: "loading" });

    const request = async () => {
      try {
        const result = (await postJSON("/assistant/assist", {
          workflow: "living_care_record",
          text:
            "Put this newly saved caregiver-reported update in context with the authorized Living Care Record. " +
            "Distinguish documented information from interpretation and uncertainty. Explain what may matter and " +
            "one proportionate next step only when supported. Do not diagnose, infer causation, or claim any record write. " +
            "Newly saved caregiver report: " + rawInput.trim(),
        })) as AssistResult;

        if (
          !result ||
          result.ai_generated !== true ||
          result.review_required !== true ||
          result.written_to_lcr !== false ||
          result.persistence !== "read_only_assistance" ||
          !result.claim_provenance ||
          !Array.isArray(result.claim_provenance.claims) ||
          result.claim_provenance.claims.some((claim) =>
            typeof claim?.text !== "string" ||
            typeof claim?.support_status !== "string" ||
            !Array.isArray(claim?.source_references)
          ) ||
          typeof result.reply !== "string" ||
          !result.reply.trim()
        ) {
          throw new Error("The LCR assistance response did not satisfy its read-only contract.");
        }
        if (!cancelled) setState({ status: "ready", result });
      } catch {
        if (!cancelled) setState({ status: "unavailable" });
      }
    };

    void request();
    return () => {
      cancelled = true;
    };
  }, [rawInput, sourceEventId]);

  if (!sourceEventId || !rawInput.trim()) return null;

  return (
    <section className="care-card-changed lcr-qwen-interpretation" aria-label="Record context interpretation">
      <h3 className="section-kicker">Record context</h3>
      {state.status === "loading" && (
        <p className="panel-muted" role="status">Connecting this update to the saved care history…</p>
      )}
      {state.status === "unavailable" && (
        <p className="panel-muted" role="status">
          Context interpretation is temporarily unavailable. Your saved care record is unchanged; you do not need to submit the update again.
        </p>
      )}
      {state.status === "ready" && (
        <>
          <p>{state.result.reply}</p>
          <p className="panel-muted">
            AI-generated interpretation for caregiver review. The Living Care Record remains authoritative; this response did not change it.
          </p>
          {state.result.claim_provenance?.claims && state.result.claim_provenance.claims.length > 0 && (
            <section aria-label="What each statement is based on" className="lcr-qwen-claim-sources">
              <strong>What each statement is based on</strong>
              {state.result.claim_provenance.claims.map((claim) => (
                <article key={claim.claim_id}>
                  <p><strong>{claim.text}</strong></p>
                  {claim.support_status === "matched_validated_aggregate" && (
                    <p>Counted from {claim.aggregate?.count ?? claim.source_references.length} distinct saved care updates{claim.aggregate?.window_label ? " during " + claim.aggregate.window_label : ""}.</p>
                  )}
                  {claim.support_status === "aggregate_count_mismatch" && <p>The saved care updates do not support this number. The count check found {claim.aggregate_review?.count ?? "an unconfirmed number"} distinct updates in the requested time window.</p>}
                  {claim.support_status === "aggregate_not_validated" && <p>{claim.aggregate_review?.interpretation_limit || "This total could not be confirmed from the saved care updates. Check the reports before relying on a number."}</p>}
                  {claim.support_status === "matched_saved_wording" && <p>This wording appears in a saved record.</p>}
                  {claim.support_status === "matched_historical_only" && <p>This wording appears only in an earlier or corrected record. It is not treated as current information.</p>}
                  {claim.support_status === "not_matched_to_saved_wording" && <p>We could not match this statement to the wording in a saved record. Check it before relying on it.</p>}
                  {claim.source_references.map((source, index) => (
                    <div key={(source.label || "source") + index}>
                      <strong>{source.label || "Saved care information"}</strong>
                      {source.occurred_at && <p>When it happened: {new Date(source.occurred_at).toLocaleString()}</p>}
                      {source.recorded_at && <p>When it was recorded: {new Date(source.recorded_at).toLocaleString()}</p>}
                      {source.reported_by && <p>Reported by: {source.reported_by}</p>}
                      {source.entered_by && <p>Recorded by: {source.entered_by}</p>}
                      {source.source_excerpt && <blockquote>{source.source_excerpt}</blockquote>}
                      {source.related_evidence?.map((evidence, evidenceIndex) => (
                        <div key={"related-" + evidenceIndex}>
                          <strong>{evidence.label || "Supporting note or document"}</strong>
                          {evidence.reported_by && <p>Reported by: {evidence.reported_by}</p>}
                          {evidence.entered_by && <p>Added by: {evidence.entered_by}</p>}
                          {evidence.recorded_at && <p>Added on: {new Date(evidence.recorded_at).toLocaleString()}</p>}
                          {evidence.source_excerpt && <blockquote>{evidence.source_excerpt}</blockquote>}
                          {evidence.observations?.map((observation, observationIndex) => (
                            <div key={"observation-" + observationIndex}>
                              <p>{observation.label || "Recorded detail"}: {observation.value || observation.attribute || "Details not supplied"}</p>
                              {observation.reported_by && <p>Reported by: {observation.reported_by}</p>}
                              {observation.occurred_at && <p>When it happened: {new Date(observation.occurred_at).toLocaleString()}</p>}
                              {observation.source_excerpt && <blockquote>{observation.source_excerpt}</blockquote>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </article>
              ))}
            </section>
          )}
          {(state.result.source_event_ids?.length || state.result.source_evidence_ids?.length) ? (
            <p className="panel-muted">
              Context supplied: {state.result.source_event_ids?.length ?? 0} saved care updates and {state.result.source_evidence_ids?.length ?? 0} source records.
            </p>
          ) : (
            <p className="panel-muted">No saved source records were returned with this interpretation.</p>
          )}
        </>
      )}
    </section>
  );
}
