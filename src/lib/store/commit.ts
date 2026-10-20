import type { SolenOSOutput } from "../output-contract/types";
import {
  appendEvent,
  getSessionEvents,
  linkEvents,
} from "./event-store";
import { persistMemoryFromTurn } from "./memory-adapter";
import type {
  DecisionRecord,
  SignalSnapshot,
  SolenOSStore,
  StateSnapshot,
} from "./types";
import type { SolenOSState } from "../process/types";
import { COGNITIVE_VERSION } from "./version";
import { newId, nowIso } from "./utils";

export interface CommitTurnParams {
  store: SolenOSStore;
  session_id: string;
  user_id: string;
  input: string;
  output: SolenOSOutput;
  new_state: SolenOSState;
  event_offset_before: number;
}

/**
 * Event commit — append-only, after validation gate passes.
 */
export function commitTurn(params: CommitTurnParams): number {
  const { store, session_id, user_id, input, output, new_state } = params;

  const inputEvent = appendEvent(store, {
    session_id,
    user_id,
    type: "input_received",
    payload: { input: input.trim() },
  });

  const classEvent = appendEvent(store, {
    session_id,
    user_id,
    type: "classification_completed",
    payload: {
      type: new_state.classification,
      confidence: new_state.decision.confidence,
    },
  });
  linkEvents(store, inputEvent.event_id, classEvent.event_id, "triggered");

  const signalEvent = appendEvent(store, {
    session_id,
    user_id,
    type: "signal_extracted",
    payload: { signals: new_state.signals },
  });
  linkEvents(store, classEvent.event_id, signalEvent.event_id, "triggered");

  store.signals.push({
    signal_id: newId("sig", session_id, params.event_offset_before),
    session_id,
    source_event_id: signalEvent.event_id,
    urgency_signals: new_state.signals.urgency_signals,
    medical_entities: new_state.signals.medical_entities,
    emotional_intensity: new_state.signals.emotional_intensity,
    uncertainty_markers: new_state.signals.uncertainty_markers,
    context_entities: new_state.signals.context_entities,
    created_at: nowIso(),
    cognitive_version: { ...COGNITIVE_VERSION },
  });

  const decisionEvent = appendEvent(store, {
    session_id,
    user_id,
    type: "decision_generated",
    payload: {
      primary_action: new_state.decision.primary_action,
      priority_score: new_state.decision.priority_score,
      risk_level: new_state.decision.risk_level,
    },
  });
  linkEvents(store, signalEvent.event_id, decisionEvent.event_id, "triggered");

  const decisionRecord: DecisionRecord = {
    decision_id: newId("dec", session_id, params.event_offset_before),
    session_id,
    source_event_id: decisionEvent.event_id,
    primary_action: new_state.decision.primary_action,
    priority_score: new_state.decision.priority_score,
    risk_level: new_state.decision.risk_level,
    decision_trace: {
      signals_used: [
        ...new_state.signals.medical_entities,
        ...new_state.signals.uncertainty_markers,
      ],
      risk_factors: new_state.decision.blocking_factor
        ? [new_state.decision.blocking_factor]
        : [],
      prioritization_logic: [`priority_score=${new_state.decision.priority_score}`],
      confidence_drivers: [`confidence=${new_state.decision.confidence}`],
    },
    safe_mode: new_state.safe_mode,
    created_at: nowIso(),
    cognitive_version: { ...COGNITIVE_VERSION },
  };
  store.decisions.push(decisionRecord);

  const riskEvent = appendEvent(store, {
    session_id,
    user_id,
    type: "risk_assessed",
    payload: { internal: new_state.risk.internal, output: new_state.risk.output },
  });
  linkEvents(store, decisionEvent.event_id, riskEvent.event_id, "triggered");

  if (new_state.safe_mode) {
    const safeEvent = appendEvent(store, {
      session_id,
      user_id,
      type: "safe_mode_triggered",
      payload: { output_risk: output.risk_level },
    });
    linkEvents(store, decisionEvent.event_id, safeEvent.event_id, "reinforced");
  }

  persistMemoryFromTurn(store, {
    user_id,
    session_id,
    source_event_id: inputEvent.event_id,
    raw: input.trim(),
    signals: new_state.signals,
    summary: output.what_is_happening,
    unresolved: new_state.decision.blocking_factor,
    offset: store.memory.length,
  });

  const eventOffset = getSessionEvents(store, session_id).length;
  const snapshot: StateSnapshot = {
    snapshot_id: newId("snap", session_id, eventOffset),
    session_id,
    kernel_state: new_state,
    event_offset: eventOffset,
    created_at: nowIso(),
    cognitive_version: { ...COGNITIVE_VERSION },
  };
  store.snapshots.push(snapshot);

  const session = store.sessions.find((s) => s.session_id === session_id);
  if (session) {
    session.current_state_ref = snapshot.snapshot_id;
    session.last_active = nowIso();
  }

  return eventOffset;
}
