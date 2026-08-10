import type {
  StateField,
  ChangeRecord,
  ChangeType,
  StateHistoryEntry,
  StateModel,
  CompareStateInput,
  CompareStateResult,
  StateDiffEngineOptions,
} from "./types";
import { createChangeId, createHistoryId } from "./ids";

export type ExistingState = {
  current: StateModel | null;
  history: StateHistoryEntry[];
};

export class StateDiffEngine {
  private readonly now: () => Date;

  constructor(options: StateDiffEngineOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  compareState(
    existing: ExistingState,
    input: CompareStateInput,
  ): CompareStateResult {
    const incomingField: StateField = {
      value: input.incoming_value,
      as_of: input.incoming_event_time,
      confidence_tag: input.incoming_confidence,
      source_claim_id: input.incoming_claim_id,
    };

    const existingState = existing.current;

    // CASE A — NO EXISTING STATE
    if (!existingState) {
      if (input.incoming_confidence === "unknown" || input.incoming_confidence === "contradictory") {
        return {
          change: null,
          updated_state: null,
          reason: `cannot create initial state from ${input.incoming_confidence} claim`,
        };
      }

      const newState: StateModel = {
        person_id: input.person_id,
        domain: input.domain,
        field: input.field,
        value: input.incoming_value,
        confidence_tag: input.incoming_confidence === "inferred" ? "inferred" : input.incoming_confidence,
        source_claim_id: input.incoming_claim_id,
        as_of: input.incoming_event_time,
        updated_at: this.now().toISOString(),
      };

      const change: ChangeRecord = {
        id: createChangeId(),
        person_id: input.person_id,
        domain: input.domain,
        field: input.field,
        previous_value: null,
        new_value: incomingField,
        detected_at: this.now().toISOString(),
        change_type: "new",
      };

      return { change, updated_state: newState };
    }

    // CASE B — SAME VALUE
    if (existingState.value === input.incoming_value) {
      return { change: null, updated_state: existingState };
    }

    // CASE E — UNKNOWN EVENT TIME
    if (!input.incoming_event_time || input.incoming_event_time.trim() === "") {
      return {
        change: null,
        updated_state: existingState,
        reason: "incoming claim has no determinable event time; change not manufactured",
      };
    }

    const incomingTime = new Date(input.incoming_event_time).getTime();
    const existingTime = new Date(existingState.as_of).getTime();

    if (isNaN(incomingTime) || isNaN(existingTime)) {
      return {
        change: null,
        updated_state: existingState,
        reason: "unresolved temporal comparison; event time could not be parsed",
      };
    }

    const isNewer = incomingTime > existingTime;
    const isOlder = incomingTime < existingTime;

    // CASE D — OLDER EVENT (BACKFILL)
    if (isOlder) {
      const historyEntry: StateHistoryEntry = {
        id: createHistoryId(),
        person_id: input.person_id,
        domain: input.domain,
        field: input.field,
        value: input.incoming_value,
        confidence_tag: input.incoming_confidence,
        source_claim_id: input.incoming_claim_id,
        as_of: input.incoming_event_time,
        replaced_at: this.now().toISOString(),
        change_id: null,
      };

      const change: ChangeRecord = {
        id: createChangeId(),
        person_id: input.person_id,
        domain: input.domain,
        field: input.field,
        previous_value: {
          value: existingState.value,
          as_of: existingState.as_of,
          confidence_tag: existingState.confidence_tag,
          source_claim_id: existingState.source_claim_id,
        },
        new_value: incomingField,
        detected_at: this.now().toISOString(),
        change_type: "backfilled",
      };

      return {
        change,
        updated_state: null,
        history_entry: historyEntry,
        reason: "backfilled; current state preserved",
      };
    }

    // CASE C — NEWER EVENT + DIFFERENT VALUE (GENUINE CHANGE)
    if (isNewer) {
      // Confidence rules
      if (input.incoming_confidence === "unknown") {
        return {
          change: null,
          updated_state: existingState,
          reason: "unknown confidence claim cannot update current state",
        };
      }

      if (input.incoming_confidence === "contradictory") {
        const historyEntry: StateHistoryEntry = {
          id: createHistoryId(),
          person_id: input.person_id,
          domain: input.domain,
          field: input.field,
          value: input.incoming_value,
          confidence_tag: "contradictory",
          source_claim_id: input.incoming_claim_id,
          as_of: input.incoming_event_time,
          replaced_at: this.now().toISOString(),
          change_id: null,
        };

        return {
          change: null,
          updated_state: existingState,
          history_entry: historyEntry,
          reason: "contradictory claim preserved in history; current state not overwritten",
        };
      }

      const finalConfidence =
        input.incoming_confidence === "inferred" ? "inferred" : input.incoming_confidence;

      const newState: StateModel = {
        person_id: input.person_id,
        domain: input.domain,
        field: input.field,
        value: input.incoming_value,
        confidence_tag: finalConfidence,
        source_claim_id: input.incoming_claim_id,
        as_of: input.incoming_event_time,
        updated_at: this.now().toISOString(),
      };

      const historyEntry: StateHistoryEntry = {
        id: createHistoryId(),
        person_id: input.person_id,
        domain: input.domain,
        field: input.field,
        value: existingState.value,
        confidence_tag: existingState.confidence_tag,
        source_claim_id: existingState.source_claim_id,
        as_of: existingState.as_of,
        replaced_at: this.now().toISOString(),
        change_id: null,
      };

      const change: ChangeRecord = {
        id: createChangeId(),
        person_id: input.person_id,
        domain: input.domain,
        field: input.field,
        previous_value: {
          value: existingState.value,
          as_of: existingState.as_of,
          confidence_tag: existingState.confidence_tag,
          source_claim_id: existingState.source_claim_id,
        },
        new_value: incomingField,
        detected_at: this.now().toISOString(),
        change_type: "changed",
      };

      return {
        change,
        updated_state: newState,
        history_entry: historyEntry,
      };
    }

    // Same timestamp but different value — treat as changed
    if (existingState.value !== input.incoming_value) {
      if (input.incoming_confidence === "unknown" || input.incoming_confidence === "contradictory") {
        return {
          change: null,
          updated_state: existingState,
          reason: `${input.incoming_confidence} claim cannot overwrite current state at same timestamp`,
        };
      }

      const finalConfidence =
        input.incoming_confidence === "inferred" ? "inferred" : input.incoming_confidence;

      const newState: StateModel = {
        ...existingState,
        value: input.incoming_value,
        confidence_tag: finalConfidence,
        source_claim_id: input.incoming_claim_id,
        as_of: input.incoming_event_time,
        updated_at: this.now().toISOString(),
      };

      const change: ChangeRecord = {
        id: createChangeId(),
        person_id: input.person_id,
        domain: input.domain,
        field: input.field,
        previous_value: {
          value: existingState.value,
          as_of: existingState.as_of,
          confidence_tag: existingState.confidence_tag,
          source_claim_id: existingState.source_claim_id,
        },
        new_value: incomingField,
        detected_at: this.now().toISOString(),
        change_type: "changed",
      };

      return { change, updated_state: newState };
    }

    return { change: null, updated_state: existingState };
  }
}

export type { StateDiffEngine as DiffEngine };
