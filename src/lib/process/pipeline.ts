import type { SolenOSOutput } from "../output-contract/types";
import { parseOrThrow, SolenOSOutputSchema } from "../schemas";
import type { ProcessResult, SolenOSState } from "./types";
import { createInitialState } from "./types";
import { classifyInput, toClassificationSchema } from "./classification";
import { extractSignals } from "./signal-extraction";
import { tagDomain } from "./domain-tagging";
import { runDecisionEngine } from "./decision-engine";
import { mapResponse } from "./response-mapping";
import { validatePipelineOutput } from "./validation-engine";
import { shouldEnterSafeMode, applySafeMode, safeModeMinimalInput } from "./safe-mode";
import { updateMemory, buildNewState } from "./memory";
import { validatePipelineOutputContract } from "../output-contract/validate";
import { ClassificationSchema, SignalVectorSchema } from "../schemas";

export interface PipelineResult extends ProcessResult {
  pipeline: {
    classification: ReturnType<typeof toClassificationSchema>;
    signals: import("./types").SignalVector;
    domain: import("./types").DomainTag;
    safe_mode: boolean;
    validation_errors: string[];
  };
}

/**
 * Deterministic orchestration pipeline.
 * Flow: classify → signals → decision → response → validate
 */
export function runPipeline(
  input: string,
  state: SolenOSState = createInitialState(),
): PipelineResult {
  const raw = input.trim();

  const classResult = classifyInput(raw);
  parseOrThrow(ClassificationSchema, toClassificationSchema(classResult));

  let signals = extractSignals(raw);
  parseOrThrow(SignalVectorSchema, signals);

  const domainResult = tagDomain(classResult.type, signals, raw);

  if (classResult.type === "ambiguous" && raw.length < 3) {
    const output = safeModeMinimalInput("ambiguous", domainResult.primary);
    const memory = updateMemory(state, raw, signals, raw, "");
    memory.last_question = output.what_to_ask_next[0] ?? "";
    const new_state = buildNewState(state, {
      input: raw,
      classification: "ambiguous",
      signals,
      domain: domainResult.primary,
      secondary_domains: domainResult.secondary,
      decision: { ...state.decision, confidence: 0.3 },
      risk: { internal: "YELLOW", output: "medium" },
      memory,
      output,
      safe_mode: true,
    });
    return {
      output,
      new_state,
      pipeline: {
        classification: toClassificationSchema(classResult),
        signals,
        domain: domainResult.primary,
        safe_mode: true,
        validation_errors: [],
      },
    };
  }

  let decision = runDecisionEngine(
    raw,
    classResult.type,
    signals,
    domainResult.primary,
    state.memory,
  );

  const uncertain =
    signals.uncertainty_markers.length > 0 || classResult.type === "ambiguous";

  const conflicting_signals =
    classResult.secondary_tags.includes("emergency") &&
    classResult.type === "emotional_signal";

  let safe_mode = false;
  let output = mapResponse({
    raw,
    classification: classResult.type,
    domain: domainResult.primary,
    signals,
    decision,
    safe_mode: false,
  });

  let validation = validatePipelineOutput(output, raw, signals, decision);
  decision = {
    ...decision,
    confidence: Math.max(0.2, decision.confidence + validation.confidence_adjustment),
  };

  const safeTrigger = shouldEnterSafeMode({
    confidence: decision.confidence,
    classification: classResult.type,
    validation_failed: !validation.valid,
    conflicting_signals,
    ambiguity: uncertain,
    priority_score: decision.priority_score,
    has_concrete_action: Boolean(decision.primary_action),
  });

  if (safeTrigger.active) {
    safe_mode = true;
    output = applySafeMode({
      raw,
      classification: classResult.type,
      domain: domainResult.primary,
      decision,
      signals,
      reason: safeTrigger.reason,
    });
    validation = validatePipelineOutput(output, raw, signals, decision);
    if (!validation.valid) {
      output = safeModeMinimalInput(classResult.type, domainResult.primary);
    }
  }

  parseOrThrow(SolenOSOutputSchema, output);
  validatePipelineOutputContract(output);

  const risk = { internal: decision.risk_level, output: output.risk_level };
  const memory = updateMemory(
    state,
    raw,
    signals,
    output.what_is_happening,
    decision.blocking_factor,
  );
  memory.last_question = output.what_to_ask_next[0] ?? "";

  const new_state = buildNewState(state, {
    input: raw,
    classification: classResult.type,
    signals,
    domain: domainResult.primary,
    secondary_domains: domainResult.secondary,
    decision,
    risk,
    memory,
    output,
    safe_mode,
  });

  return {
    output,
    new_state,
    pipeline: {
      classification: toClassificationSchema(classResult),
      signals,
      domain: domainResult.primary,
      safe_mode,
      validation_errors: validation.errors,
    },
  };
}
