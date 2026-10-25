"use client";

import type { SituationResponse } from "@/lib/situation-entry";
import { buildLivingCareRecordResponse } from "@/lib/living-care-record-ux";
import { LivingCareRecordPanel } from "./LivingCareRecordPanel";

type Props = {
  response: SituationResponse;
  rawInput: string;
  entryIntent?: "initial" | "update";
  onContinue?: () => void;
  onAddUpdate?: () => void;
  onRetryProcessing?: () => void;
  careKey?: string | null;
};

/**
 * Caregiver-facing surface: Living Care Record only.
 * Active Care Situation grows understanding across related observations.
 *
 * Product truth: `buildLivingCareRecordResponse` from ACS/composer — never `response.final_output`.
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
      return (
        <section className="panel panel-output situation-response" aria-label="Living Care Record" role="status">
          <div className="workspace-panel-inner lcr-side">
            <h3>Entry saved to the Living Care Record</h3>
            <p>
              Your entry was saved, but the full care view could not be refreshed. We won’t ask you to submit the same entry again.
            </p>
            {savedTitle && <p className="saved-entry-receipt">{savedTitle}</p>}
            {receipt.care_event_id && (
              <p className="panel-muted">Saved record reference: {receipt.care_event_id}</p>
            )}
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
      <section className="panel panel-output situation-response" aria-label="Living Care Record" role="status">
        <div className="workspace-panel-inner lcr-side">
          <h3>Saved status could not be confirmed</h3>
          <p>
            We couldn’t confirm the saved entry from the care record. Your input has not been resubmitted. Refresh the record to check its status before trying again.
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

  return (
    <section className="panel panel-output situation-response" aria-label="Living Care Record">
      {isReconstructedProjection && (
        <p className="workspace-status-warning" role="status">
          This view is reconstructed from saved evidence and events. A separate situation-reasoning state has not been persisted.
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
      </div>
    </section>
  );
}
