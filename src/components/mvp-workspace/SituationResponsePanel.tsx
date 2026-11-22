"use client";

import type { SituationResponse } from "@/lib/situation-entry";
import { buildLivingCareRecordResponse } from "@/lib/living-care-record-ux";
import { LivingCareRecordPanel } from "./LivingCareRecordPanel";
import { LcrQwenInterpretation } from "./LcrQwenInterpretation";

type Props = {
  response: SituationResponse;
  rawInput: string;
  entryIntent?: "initial" | "update";
  onContinue?: () => void;
  onAddUpdate?: () => void;
  onRetryProcessing?: () => void;
  careKey?: string | null;
};

type PersistedReceipt = {
  ok?: boolean;
  care_event_id?: string;
  evidence_id?: string;
  events?: Array<{ id?: string }>;
  events_created?: Array<{ id?: string }>;
};

function persistedSourceEventId(response: SituationResponse): string | null {
  const receipt = response as SituationResponse & PersistedReceipt;
  if (receipt.ok !== true) return null;
  const id =
    receipt.care_event_id ||
    receipt.events?.find((event) => Boolean(event.id))?.id ||
    receipt.events_created?.find((event) => Boolean(event.id))?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/**
 * Caregiver-facing surface: Living Care Record only.
 * Active Care Situation grows understanding across related observations.
 *
 * Product truth: buildLivingCareRecordResponse from ACS/composer — never response.final_output.
 * Qwen provides an additional review-only interpretation; it cannot replace or write the LCR.
 * @see docs/17-canonical-architecture/product-truth-path.md
 */
export function SituationResponsePanel({
  response,
  rawInput,
  entryIntent,
  onContinue,
  onAddUpdate,
  careKey = null,
}: Props) {
  if (!response.active_care_situation && !response.active_care_situation_turn) {
    const receipt = response as SituationResponse & {
      ok?: boolean;
      care_event_id?: string;
      evidence_id?: string;
      message?: string;
      events?: Array<{ id?: string; title?: string; description?: string | null; occurred_at?: string }>;
      events_created?: Array<{ id?: string; raw_input?: string }>;
    };
    const persistedEvent =
      receipt.ok === true &&
      Boolean(
        receipt.care_event_id ||
        receipt.evidence_id ||
        receipt.events_created?.some((event) => Boolean(event.id)) ||
        receipt.events?.some((event) => Boolean(event.id)),
      );
    const savedTitle =
      receipt.events?.find((event) => event.id === receipt.care_event_id)?.title ||
      receipt.events_created?.find((event) => event.id === receipt.care_event_id)?.raw_input ||
      rawInput.trim();

    if (persistedEvent) {
      const sourceEventId = persistedSourceEventId(response);
      return (
        <section className="panel panel-output situation-response" aria-label="Care Record" role="status">
          <div className="workspace-panel-inner lcr-side">
            <h3>Your update was saved to your Care Record</h3>
            <p>
              Your update was saved, but SolenOS could not refresh your Care Record. We won’t ask you to submit the same information again.
            </p>
            {savedTitle && <p className="saved-entry-receipt">{savedTitle}</p>}
            <LcrQwenInterpretation rawInput={rawInput} sourceEventId={sourceEventId} />
            {onContinue && (
              <button type="button" onClick={onContinue}>
                Continue
              </button>
            )}
            {onAddUpdate && (
              <button type="button" onClick={onAddUpdate}>
                Add another update
              </button>
            )}
          </div>
        </section>
      );
    }

    return (
      <section className="panel panel-output situation-response" aria-label="Care Record" role="status">
        <div className="workspace-panel-inner lcr-side">
          <h3>We couldn’t check whether your update was saved</h3>
          <p>
            We couldn’t confirm whether your update was saved. We have not sent it again. Refresh your Care Record before trying again.
          </p>
        </div>
      </section>
    );
  }

  const livingRecord = buildLivingCareRecordResponse({
    response,
    rawInput,
    entryIntent,
  });
  const activeProjection = response.active_care_situation as
    | (NonNullable<SituationResponse["active_care_situation"]> & {
        persistence_source?: string;
        reasoning_state_persisted?: boolean;
      })
    | undefined;
  const isReconstructedProjection =
    activeProjection?.persistence_source === "relational_evidence_and_events_projection" &&
    activeProjection.reasoning_state_persisted === false;
  const sourceEventId = persistedSourceEventId(response);

  return (
    <section className="panel panel-output situation-response" aria-label="Care Record">
      {isReconstructedProjection && (
        <p className="workspace-status-warning" role="status">
          This summary was put together from saved care updates. Some details about how they fit together may not be available yet.
        </p>
      )}
      <div className="workspace-panel-inner lcr-side">
        <LivingCareRecordPanel
          view={livingRecord}
          onContinue={onContinue}
          onAddUpdate={onAddUpdate}
          careKey={careKey}
          rawInputExcerpt={rawInput}
        />
        <LcrQwenInterpretation rawInput={rawInput} sourceEventId={sourceEventId} />
      </div>
    </section>
  );
}
