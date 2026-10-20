import { NextRequest, NextResponse } from "next/server";
import { isAnalyzeFailure, runAnalyzePipeline } from "@/lib/analyze-pipeline";
import { recordReliefMeasurementEvent } from "@/lib/telemetry-persistence/server";
import type { CaregiverDepletionSignalsResult } from "@/lib/caregiver-depletion-signals";
import {
import { withAuthentication } from '@/lib/auth/middleware';
  ANALYZE_OPS_KEY_HEADER,
  analyzePipelineDisabledResponse,
  isAnalyzePipelineEnabled,
} from "@/lib/analyze-pipeline/caregiver-entry-gate";

export const runtime = "nodejs";

async function postAnalyzeHandler(request: NextRequest, user: any) {
  // /api/analyze is an ops/engine path, not a caregiver entry. Caregiver surfaces
  // use /api/situation, which is the only path that writes to the Living Care Record.
  if (!isAnalyzePipelineEnabled({ opsKey: request.headers.get(ANALYZE_OPS_KEY_HEADER) })) {
    const disabled = analyzePipelineDisabledResponse();
    return NextResponse.json(
      { error: disabled.error, caregiver_entry: disabled.caregiver_entry },
      { status: disabled.status },
    );
  }

  try {
    const body = await request.json();
    const { input, context } = body ?? {};

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "input is required" },
        { status: 400 },
      );
    }

    const result = await runAnalyzePipeline({
      raw_input: input,
      ...context,
    });

    if (isAnalyzeFailure(result)) {
      return NextResponse.json(result, { status: 422 });
    }

    // Step 10: RELIEF + SIGNAL LOGGING
    // Persist caregiver depletion signals as telemetry labels on the interaction.
    const depletionSignals = (result as any)
      .caregiver_depletion_signals as CaregiverDepletionSignalsResult | undefined;

    const caregiver_depletion_state =
      depletionSignals?.caregiver_depletion_state ?? "normal";
    const is_single_caregiver =
      depletionSignals?.is_single_caregiver ?? false;
    const environmental_dependency_flag =
      depletionSignals?.environmental_dependency_flag ?? "none";

    void recordReliefMeasurementEvent({
      telemetry_user_id: user.telemetry_user_id ?? "anonymous",
      input_raw: input,
      prior_input_raw: input,
      output: result,
      latency_ms: 0,
      structure_valid: true,
      care_context_state: "active_care",
      caregiver_depletion_state,
      is_single_caregiver,
      environmental_dependency_flag,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[analyze] pipeline error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 },
    );
  }
}



export const POST = withAuthentication(postAnalyzeHandler);





