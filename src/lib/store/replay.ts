import { process, createInitialState } from "../process";
import type { SolenOSOutput } from "../output-contract/types";
import { getSessionEvents } from "./event-store";
import { getSessionMemoryItems, memoryItemsToSessionMemory } from "./memory-adapter";
import type { SolenOSStore } from "./types";
import { COGNITIVE_VERSION, versionsMatch } from "./version";

export interface ReplayResult {
  outputs: SolenOSOutput[];
  matches_stored_decisions: boolean;
  errors: string[];
}

function memoryBeforeEvent(
  store: SolenOSStore,
  sessionId: string,
  events: import("./types").CareEvent[],
  eventIndex: number,
): ReturnType<typeof getSessionMemoryItems> {
  return store.memory.filter((m) => {
    if (m.session_id !== sessionId) return false;
    const srcIdx = events.findIndex((e) => e.event_id === m.source_event_id);
    return srcIdx >= 0 && srcIdx < eventIndex;
  });
}

/**
 * Deterministic replay from input_received events + session memory.
 * Same events + same kernel version => identical outputs.
 */
export function replaySession(store: SolenOSStore, sessionId: string): ReplayResult {
  const errors: string[] = [];
  const events = getSessionEvents(store, sessionId);
  const inputEvents = events.filter((e) => e.type === "input_received");

  if (inputEvents.length === 0) {
    return { outputs: [], matches_stored_decisions: true, errors: ["no input events"] };
  }

  for (const evt of events) {
    if (!versionsMatch(evt.cognitive_version, COGNITIVE_VERSION)) {
      errors.push(`version mismatch at event ${evt.event_id}`);
    }
  }

  const outputs: SolenOSOutput[] = [];
  const storedDecisions = store.decisions.filter((d) => d.session_id === sessionId);

  for (let i = 0; i < inputEvents.length; i++) {
    const inputEvt = inputEvents[i];
    const input = String(inputEvt.payload.input ?? "");

    const eventIndex = events.indexOf(inputEvt);
    const priorMemory = memoryBeforeEvent(store, sessionId, events, eventIndex);

    const state = {
      ...createInitialState(),
      memory: memoryItemsToSessionMemory(priorMemory),
    };

    const { output } = process(input, state);
    outputs.push(output);

    const stored = storedDecisions[i];
    const snap = store.snapshots.find(
      (s) =>
        s.session_id === sessionId &&
        s.kernel_state.input === input,
    );
    const storedOutput = snap?.kernel_state.output;
    if (storedOutput && storedOutput.what_matters_now !== output.what_matters_now) {
      errors.push(
        `turn ${i + 1}: replay action mismatch`,
      );
    }
  }

  return {
    outputs,
    matches_stored_decisions: errors.filter((e) => e.startsWith("turn")).length === 0,
    errors,
  };
}

export function replayFromSnapshot(
  store: SolenOSStore,
  sessionId: string,
): SolenOSOutput | undefined {
  const snaps = store.snapshots
    .filter((s) => s.session_id === sessionId)
    .sort((a, b) => b.event_offset - a.event_offset);
  return snaps[0]?.kernel_state.output;
}
