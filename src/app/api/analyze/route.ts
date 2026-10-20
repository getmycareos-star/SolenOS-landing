import { NextRequest, NextResponse } from "next/server";
import { isAnalyzeFailure, runAnalyzePipeline } from "@/lib/analyze-pipeline";
import { recordReliefMeasurementEvent } from "@/lib/telemetry-persistence/server";
import type { CaregiverDepletionSignalsResult } from "@/lib/caregiver-depletion-signals";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
      telemetry_user_id: context?.telemetry_user_id ?? "anonymous",
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
