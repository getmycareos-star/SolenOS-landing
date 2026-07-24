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
