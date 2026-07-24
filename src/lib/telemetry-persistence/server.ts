import type { CareContextState } from "../post-care-insight";
import type { CaregiverDepletionSignalsResult } from "../caregiver-depletion-signals";
import type { SolenOSResponse } from "../response-validator";

import type { TelemetryStore } from "./types";

import { getMemoryTelemetryStore } from "./memory-store";

import { createPostgresPool, PostgresTelemetryStore } from "./postgres-store";

import type { TelemetryFeedbackSubmit } from "./schema";
import { setFeedbackContainmentFromFeedback } from "./feedback-containment";

import {

  categorizeInput,

  classifyReliefOutcomeAtAnalyze,

  createInitialReliefSignals,

} from "../relief-validation";



let storePromise: Promise<TelemetryStore> | null = null;



async function resolveTelemetryStore(): Promise<TelemetryStore> {

  if (process.env.DATABASE_URL) {

    const pool = await createPostgresPool();

    return new PostgresTelemetryStore(pool);

  }

  return getMemoryTelemetryStore();

}



export async function getTelemetryStore(): Promise<TelemetryStore> {

  if (!storePromise) {

    storePromise = resolveTelemetryStore();

  }

  return storePromise;

}



export function resetTelemetryStoreForTests(): void {

  storePromise = null;

}



export interface RecordReliefMeasurementParams {

  telemetry_user_id?: string;

  input_raw: string;

  prior_input_raw?: string;

  output: SolenOSResponse;

  latency_ms: number;

  structure_valid: boolean;

  care_context_state: CareContextState;

  caregiver_depletion_state: CaregiverDepletionSignalsResult["caregiver_depletion_state"];

  is_single_caregiver: CaregiverDepletionSignalsResult["is_single_caregiver"];

  environmental_dependency_flag: CaregiverDepletionSignalsResult["environmental_dependency_flag"];

}



export async function recordReliefMeasurementEvent(

  params: RecordReliefMeasurementParams,

): Promise<{ user_id: string; interaction_id: string } | null> {

  if (process.env.SOLENOS_TELEMETRY_DISABLED === "1") {

    return null;

  }



  const store = await getTelemetryStore();

  const { user_id } = await store.ensureUser(params.telemetry_user_id);



  const priorInput =

    params.prior_input_raw ?? (await store.getLastInteractionInput(user_id));

  const signals = createInitialReliefSignals({

    input: params.input_raw,

    priorInput,

  });



  return store.recordReliefEvent({

    user_id,

    input_raw: params.input_raw,

    output_structured: params.output,

    risk_level: params.output.risk_level,

    latency_ms: params.latency_ms,

    structure_valid: params.structure_valid,

    semantic_valid: true,

    input_category: categorizeInput(params.input_raw),

    relief_outcome: classifyReliefOutcomeAtAnalyze(signals),

    requery_detected: signals.requery_detected,

    helpful_feedback: null,

    care_context_state: params.care_context_state,

    caregiver_depletion_state: params.caregiver_depletion_state,

    is_single_caregiver: params.is_single_caregiver,

    environmental_dependency_flag: params.environmental_dependency_flag,

  });

}



export async function recordReliefFeedback(feedback: TelemetryFeedbackSubmit): Promise<void> {

  if (process.env.SOLENOS_TELEMETRY_DISABLED === "1") {

    return;

  }

  const store = await getTelemetryStore();

  await store.recordFeedback(feedback);

  if (feedback.care_key?.trim()) {
    setFeedbackContainmentFromFeedback({
      careKey: feedback.care_key.trim(),
      feedback,
    });
    // Slice 5.6 — attach feedback proxies to latest research event (ops only; no survey UI).
    try {
      const { attachFeedbackToRetentionResearch } = await import(
        "../mvp-research-validation/retention-instrumentation"
      );
      attachFeedbackToRetentionResearch({
        careKey: feedback.care_key.trim(),
        helpfulFeedback: feedback.helpful_yes_no,
        reducedConfusion: feedback.reduced_confusion_yes_no,
      });
    } catch {
      /* non-fatal */
    }
  }

}


