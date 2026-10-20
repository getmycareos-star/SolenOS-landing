import {
  CONTINUOUS_EXECUTION_IDENTITY,
  EXECUTION_LOOP_DEFINITION,
  MAX_SURFACED_PRIORITY_ITEMS,
} from "./contract-constants";
import { classifyStateOperation, classifyUnifiedInput, resolveSystemMode } from "./classify-input";
import { computeStateDiff, diffHasOutputTrigger, diffToSummaryLines } from "./diff-engine";
import { runIdleLoop } from "./idle-loop";
import { buildRawInputEvent } from "./raw-input-event";
import {
  getOpenUncertainties,
  recordContextSnapshot,
  syncUncertaintyStateMachine,
} from "./uncertainty-store";
import type {
  ContinuousExecutionLoopLayer,
  ProcessExecutionLoopInput,
  ReprocessLoopInput,
} from "./types";
import { queryPriorityEvents } from "../care-event-priority";
import {
  caregiverLineFromDareUncertain,
  caregiverLineFromUnreadableSection,
} from "../situation-entry/caregiver-facing-uncertainty";

export { CONTINUOUS_EXECUTION_IDENTITY, EXECUTION_LOOP_DEFINITION };

export function processContinuousExecutionLoop(
  input: ProcessExecutionLoopInput,
): ContinuousExecutionLoopLayer {
  const inputType = input.input_type;
  const operation = classifyStateOperation(inputType);
  const systemMode = resolveSystemMode(input.is_first_situation, input.context.events.length);

  const raw_input_event = buildRawInputEvent({
    caregiver_id: input.caregiver_id,
    raw_text: input.raw_input,
    input_type: inputType,
    captured_at: input.captured_at,
    document_ids: input.document_ids,
    target_event_id: input.target_event_id,
  });

  const diff = computeStateDiff(
    input.prior_context,
    input.context,
    input.events_created,
    input.dare,
  );

  if (input.dare) {
    for (const u of input.dare.uncertain_events) {
      const line = caregiverLineFromDareUncertain(u);
      if (line) diff.new_uncertainty.push(line);
    }
    for (const s of input.dare.unreadable_sections) {
      diff.new_uncertainty.push(caregiverLineFromUnreadableSection(s.reason));
    }
  }

  const clarificationQuestions = [
    ...(input.dare?.disambiguation_questions.map((q) => q.question) ?? []),
    ...(input.dare?.normalization?.clarification_question
      ? [input.dare.normalization.clarification_question]
      : []),
  ];

  const openLabels = input.events_created.flatMap((e) => e.uncertainty);
  const uncertainty_records = syncUncertaintyStateMachine({
    caregiver_id: input.caregiver_id,
    diff,
    clarification_questions: clarificationQuestions,
    open_labels: openLabels,
    invalidated_labels:
      operation === "correct"
        ? diff.resolved_uncertainty
        : undefined,
  });

  const what_changed = diffToSummaryLines(diff, input.context.events);
  const priorityQuery = queryPriorityEvents(input.context.events);
  const priority_event_ids = [
    ...priorityQuery.attention_events.map((e) => e.id),
    ...priorityQuery.top_events.map((e) => e.id),
  ]
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .slice(0, MAX_SURFACED_PRIORITY_ITEMS);

  const open_uncertainties = getOpenUncertainties(input.caregiver_id);

  recordContextSnapshot(
    input.caregiver_id,
    input.context.events.length,
    open_uncertainties.length,
  );

  const idle_refresh =
    inputType === "idle_refresh"
      ? runIdleLoop({ caregiver_id: input.caregiver_id, context: input.context })
      : null;

  return {
    system_mode: systemMode,
    loop_phase: diffHasOutputTrigger(diff) ? "generate_output" : "wait",
    operation,
    raw_input_event,
    diff,
    what_changed,
    uncertainty_records,
    open_uncertainties,
    priority_event_ids,
    hidden_priority_count: priorityQuery.hidden_count,
    output_triggered_by_diff: diffHasOutputTrigger(diff),
    idle_refresh,
    loop_definition: EXECUTION_LOOP_DEFINITION,
  };
}

export function reprocessContinuousExecutionLoop(
  input: ReprocessLoopInput,
): ContinuousExecutionLoopLayer {
  const priorCount = Math.max(0, input.context.events.length - 1);
  const priorContext =
    input.context.events.length > 0
      ? {
          ...input.context,
          events: input.context.events.slice(0, priorCount),
        }
      : null;

  const inputType = input.trigger === "idle_refresh" ? "idle_refresh" : "correction";

  return processContinuousExecutionLoop({
    caregiver_id: input.caregiver_id,
    raw_input:
      input.trigger === "correction"
        ? `User correction applied${input.correction_event_id ? ` to event ${input.correction_event_id}` : ""}`
        : "System idle refresh",
    input_type: inputType,
    prior_context: priorContext,
    context: input.context,
    events_created: [],
    dare: null,
    is_first_situation: false,
    target_event_id: input.correction_event_id ?? null,
  });
}

export function classifyInputForLoop(input: {
  raw_input: string;
  documents?: readonly { id: string }[];
  is_correction?: boolean;
  is_idle_refresh?: boolean;
}): ReturnType<typeof classifyUnifiedInput> {
  return classifyUnifiedInput(input);
}
