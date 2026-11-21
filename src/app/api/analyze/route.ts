import { NextRequest, NextResponse } from "next/server";
import {
  ANALYZE_OPS_KEY_HEADER,
  analyzePipelineDisabledResponse,
  isAnalyzePipelineEnabled,
} from "@/lib/analyze-pipeline/caregiver-entry-gate";
import { recordReliefMeasurementEvent } from "@/lib/telemetry-persistence/server";
import type { CaregiverDepletionSignalsResult } from "@/lib/caregiver-depletion-signals";

export const runtime = "nodejs";

/**
 * Operations-only legacy analysis path. The caregiver MVP entry is
 * authenticated POST /api/situation. This route is never enabled in production:
 * its prototype reasoning/containment modules are not PostgreSQL-authoritative.
 */
export async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    !isAnalyzePipelineEnabled({
      opsKey: request.headers.get(ANALYZE_OPS_KEY_HEADER),
    })
  ) {
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

    // Load the legacy pipeline only after the production and ops-access gates.
    const { isAnalyzeFailure, runAnalyzePipeline } = await import("@/lib/analyze-pipeline");
    const result = await runAnalyzePipeline({
      raw_input: input,
      ...context,
    });

    if (isAnalyzeFailure(result)) {
      return NextResponse.json(result, { status: 422 });
    }

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
    }).catch((telemetryError) => {
      // Telemetry is non-authoritative and must not turn a valid analysis into
      // a false success/failure. Never swallow a failed durable write silently.
      console.error("[analyze] telemetry persistence failed:", telemetryError);
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
