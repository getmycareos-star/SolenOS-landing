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
    return (
      <section className="panel panel-output situation-response" aria-label="Living Care Record" role="status">
        <div className="workspace-panel-inner lcr-side">
          <h3>Care record view unavailable</h3>
          <p>
            SolenOS did not return a persisted Active Care Situation for this response.
            Refresh the record to verify saved information before submitting the same information again.
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

  return (
    <section className="panel panel-output situation-response" aria-label="Living Care Record">
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
