"use client";

import { useEffect, useState } from "react";
import { postJSON } from "@/api/client";

type AssistResult = {
  reply?: string;
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
