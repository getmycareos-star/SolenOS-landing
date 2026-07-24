import type { CareContext } from "../care-context/types";
import type {
  OMLState,
  OutcomeMeasurementResult,
} from "./types";
import { computeOutcomeSnapshot } from "./compute-metrics";
import { buildOutcomeMeasurement } from "./compute-snapshot";

export function createEmptyOMLState(): OMLState {
  return {
    sessions: [],
    snapshots: [],
    timelineCorrections: [],
    clarifications: [],
    decisionSignals: [],
    feedback: [],
  };
}

export interface CareContextWithOML extends CareContext {
  oml?: OutcomeMeasurementResult;
}

/**
 * Every CareContext update MUST emit updated Outcome Metrics snapshot,
 * delta vs previous state, and trend direction.
 */
export function emitOutcomeMeasurement(
  context: CareContext,
  omlState: OMLState,
): { measurement: OutcomeMeasurementResult; updatedOmlState: OMLState } {
  const snapshot = computeOutcomeSnapshot(context, omlState);
  const previous =
    omlState.snapshots.length > 0
      ? omlState.snapshots[omlState.snapshots.length - 1]
      : null;

  const measurement = buildOutcomeMeasurement(snapshot, previous);

  const updatedOmlState: OMLState = {
    ...omlState,
    snapshots: [...omlState.snapshots, snapshot],
  };

  return { measurement, updatedOmlState };
}

/**
 * Integrate OML into a CareContext update — required on every context mutation.
 */
export function updateCareContextWithOML(
  context: CareContext,
  omlState: OMLState,
): { context: CareContextWithOML; omlState: OMLState } {
  const { measurement, updatedOmlState } = emitOutcomeMeasurement(
    context,
    omlState,
  );

  return {
    context: { ...context, oml: measurement },
    omlState: updatedOmlState,
  };
}

export function recordDecisionSignal(
  omlState: OMLState,
  type: OMLState["decisionSignals"][number]["type"],
  context: string,
): OMLState {
  return {
    ...omlState,
    decisionSignals: [
      ...omlState.decisionSignals,
      { type, notedAt: new Date().toISOString(), context },
    ],
  };
}

export function recordClarification(
  omlState: OMLState,
  question: string,
  resolved: boolean,
  careEventId?: string,
  repeated = false,
): OMLState {
  return {
    ...omlState,
    clarifications: [
      ...omlState.clarifications,
      {
        question,
        askedAt: new Date().toISOString(),
        resolved,
        careEventId,
        repeated,
      },
    ],
  };
}
