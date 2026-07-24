import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  isAnalyzeFailure,
  normalizeAnalyzeInput,
  parseAnalyzeRequest,
  runAnalyzePipelineWithObservability,
} from "@/lib/analyze-pipeline";
import { GEMINI_MVP_MODEL } from "@/lib/gemini-contract";
import { MULTILINGUAL_RESPONSE_HEADER } from "@/lib/multilingual-execution/constants";
import { resolveUserLanguage } from "@/lib/multilingual-execution/resolve-language";
import { resolveUserSettings } from "@/lib/settings-governance/resolve-settings";
import { MVP_LATENCY_BUDGET_MS } from "@/lib/mvp-architecture";
import { getCareSession, handleUserInteraction } from "@/lib/identity-continuity";
import { CONTINUITY_RESPONSE_HEADERS } from "@/lib/identity-continuity/contract-constants";
import { emitSystemEvent } from "@/lib/system-architecture/emit-event";
import { recordReliefMeasurementEvent, getTelemetryStore } from "@/lib/telemetry-persistence/server";
import { TELEMETRY_RESPONSE_HEADERS } from "@/lib/telemetry-persistence/schema";

import { GEMINI_ENV_MISSING_MESSAGE, getGeminiApiKey } from "@/lib/env/gemini";
import {
  ANALYZE_OPS_KEY_HEADER,
  analyzePipelineDisabledResponse,
  isAnalyzePipelineEnabled,
} from "@/lib/analyze-pipeline/caregiver-entry-gate";

/**
 * POST /api/analyze — ops/engine cognitive transformation (NOT caregiver MVP entry).
 * Caregiver entry is POST /api/situation only. Analyze requires SOLENOS_ENABLE_ANALYZE=1
 * or a valid ops key header.
 */
export async function POST(req: NextRequest) {
  if (
    !isAnalyzePipelineEnabled({
      opsKey: req.headers.get(ANALYZE_OPS_KEY_HEADER),
    })
  ) {
    const denied = analyzePipelineDisabledResponse();
    return NextResponse.json(
      { error: denied.error, caregiver_entry: denied.caregiver_entry },
      { status: denied.status },
    );
  }

  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let request;
  try {
    request = parseAnalyzeRequest(body);
  } catch {
    return NextResponse.json(
      { error: "Invalid request: input and source_type required" },
      { status: 400 },
    );
  }

  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    return NextResponse.json(
      { error: GEMINI_ENV_MISSING_MESSAGE, reason: GEMINI_ENV_MISSING_MESSAGE },
      { status: 503 },
    );
  }

  const normalized = normalizeAnalyzeInput(request.input);
  if (!normalized) {
    return NextResponse.json(
      { error: "input must be a non-empty string" },
      { status: 400 },
    );
  }

  const userLanguage = await resolveUserLanguage({
    telemetry_user_id: request.telemetry_user_id,
    language_preference: request.language_preference,
  });

  const governanceSettings = await resolveUserSettings({
    telemetry_user_id: request.telemetry_user_id,
    governance_settings: request.governance_settings,
  });

  if (request.language_preference && request.telemetry_user_id) {
    const store = await getTelemetryStore();
    await store.updateUserLanguagePreference(request.telemetry_user_id, {
      language_preference: userLanguage,
      ui_language: userLanguage,
    });
  }

  const {
    result,
    care_context_state,
    caregiver_depletion_signals,
    trust_layer,
    governance_layer,
    safety_layer,
    care_profile_layer,
    care_context_layer,
    memory_influence_layer,
    time_engine_layer,
    priority_engine_layer,
    demand_engine_layer,
    caregiver_load_layer,
    surface_demands,
    deferred_demand_titles,
    resolution_engine_layer,
    assumption_registry_layer,
    missing_information_queue_layer,
    situation_risk_register_layer,
    system_health_layer,
    responsibility_graph_layer,
    human_trust_layer,
    confidence_layer,
    crisis_prevention_layer,
    delegation_layer,
    load_interpretation_layer,
    deterministic_priority_layer,
    prioritization_engine_layer,
    caregiver_load_engine,
    risk_uncertainty_layer,
    care_journey_graph_layer,
  } = await runAnalyzePipelineWithObservability({
    input: normalized,
    geminiApiKey,
    geminiModel: process.env.SOLENOS_GEMINI_MODEL ?? GEMINI_MVP_MODEL,
    telemetry_user_id: request.telemetry_user_id,
    care_session_id: request.care_session_id,
    source_type: request.source_type,
    userLanguage,
    governanceSettings,
  });

  const latency_ms = Date.now() - startedAt;

  if (latency_ms > MVP_LATENCY_BUDGET_MS) {
    console.warn("[/api/analyze] exceeded MVP latency budget (>10s)");
  }

  if (isAnalyzeFailure(result)) {
    return NextResponse.json(result, { status: 422 });
  }

  const headers = new Headers();
  headers.set(MULTILINGUAL_RESPONSE_HEADER, userLanguage);
  try {
    const telemetry = await recordReliefMeasurementEvent({
      telemetry_user_id: request.telemetry_user_id,
      input_raw: normalized,
      prior_input_raw: request.prior_input_raw,
      output: result,
      latency_ms,
      structure_valid: true,
      care_context_state,
      caregiver_depletion_state: caregiver_depletion_signals.caregiver_depletion_state,
      is_single_caregiver: caregiver_depletion_signals.is_single_caregiver,
      environmental_dependency_flag: caregiver_depletion_signals.environmental_dependency_flag,
    });
    if (telemetry) {
      headers.set(TELEMETRY_RESPONSE_HEADERS.userId, telemetry.user_id);
      headers.set(TELEMETRY_RESPONSE_HEADERS.interactionId, telemetry.interaction_id);

      void emitSystemEvent({
        user_id: telemetry.user_id,
        event_type: "interaction_created",
        payload: { interaction_id: telemetry.interaction_id },
      }).catch((err) =>
        console.warn("[/api/analyze] interaction_created event failed (non-blocking):", err),
      );

      void emitSystemEvent({
        user_id: telemetry.user_id,
        event_type: "decision_generated",
        payload: {
          interaction_id: telemetry.interaction_id,
          risk_level: result.risk_level,
        },
      }).catch((err) =>
        console.warn("[/api/analyze] decision_generated event failed (non-blocking):", err),
      );
    }
  } catch (error) {
    console.warn("[/api/analyze] telemetry write failed (non-blocking):", error);
  }

  const telemetryUserId = headers.get(TELEMETRY_RESPONSE_HEADERS.userId) ?? request.telemetry_user_id;
  const interactionId = headers.get(TELEMETRY_RESPONSE_HEADERS.interactionId) ?? undefined;
  const careSessionId = request.care_session_id ?? randomUUID();
  const existingSession = request.care_session_id
    ? getCareSession(request.care_session_id)
    : undefined;

  const interaction = handleUserInteraction({
    input: normalized,
    source_type: request.source_type,
    prior_input_raw: request.prior_input_raw,
    resume_context: request.resume_context,
    careResult: result,
    care_context_state,
    interaction_id: interactionId,
    identityState: existingSession
      ? {
          care_session_id: existingSession.care_session_id,
          user_id: telemetryUserId ?? existingSession.user_id,
          mode: existingSession.mode,
          auth_enabled: existingSession.auth_enabled,
          has_stored_care_graph: existingSession.has_stored_care_graph,
        }
      : {
          care_session_id: careSessionId,
          user_id: telemetryUserId,
          mode: "ephemeral",
          auth_enabled: false,
          has_stored_care_graph: false,
        },
  });
  headers.set(CONTINUITY_RESPONSE_HEADERS.sessionId, interaction.care_session_id);

  const responseBody: Record<string, unknown> = { ...result };
  if (trust_layer) responseBody.trust_layer = trust_layer;
  if (governance_layer) responseBody.governance_layer = governance_layer;
  if (safety_layer) responseBody.safety_layer = safety_layer;
  if (human_trust_layer) responseBody.human_trust_layer = human_trust_layer;
  if (confidence_layer) responseBody.confidence_layer = confidence_layer;
  if (crisis_prevention_layer) responseBody.crisis_prevention_layer = crisis_prevention_layer;
  if (delegation_layer) responseBody.delegation_layer = delegation_layer;
  if (load_interpretation_layer) {
    responseBody.load_interpretation_layer = load_interpretation_layer;
  }
  if (deterministic_priority_layer) {
    responseBody.deterministic_priority_layer = deterministic_priority_layer;
  }
  if (prioritization_engine_layer) {
    responseBody.prioritization_engine_layer = prioritization_engine_layer;
  }
  if (caregiver_load_engine) responseBody.caregiver_load_engine = caregiver_load_engine;
  if (risk_uncertainty_layer) responseBody.risk_uncertainty_layer = risk_uncertainty_layer;
  if (care_journey_graph_layer) responseBody.care_journey_graph_layer = care_journey_graph_layer;
  if (care_profile_layer) responseBody.care_profile_layer = care_profile_layer;
  if (care_context_layer) responseBody.care_context_layer = care_context_layer;
  if (memory_influence_layer) responseBody.memory_influence_layer = memory_influence_layer;
  if (time_engine_layer) responseBody.time_engine_layer = time_engine_layer;
  if (priority_engine_layer) responseBody.priority_engine_layer = priority_engine_layer;
  if (demand_engine_layer) responseBody.demand_engine_layer = demand_engine_layer;
  if (caregiver_load_layer) responseBody.caregiver_load_layer = caregiver_load_layer;
  if (responsibility_graph_layer) {
    responseBody.responsibility_graph_layer = responsibility_graph_layer;
  }
  if (surface_demands) responseBody.surface_demands = surface_demands;
  if (deferred_demand_titles) responseBody.deferred_demand_titles = deferred_demand_titles;
  if (resolution_engine_layer) responseBody.resolution_engine_layer = resolution_engine_layer;
  if (assumption_registry_layer) responseBody.assumption_registry_layer = assumption_registry_layer;
  if (missing_information_queue_layer) {
    responseBody.missing_information_queue_layer = missing_information_queue_layer;
  }
  if (situation_risk_register_layer) {
    responseBody.situation_risk_register_layer = situation_risk_register_layer;
  }
  if (system_health_layer) responseBody.system_health_layer = system_health_layer;
  responseBody.continuity_layer = interaction.continuity_layer;

  return NextResponse.json(responseBody, { headers });
}
