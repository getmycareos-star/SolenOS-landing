import type { StateModel, StateHistoryEntry, ChangeRecord } from "./types";
import type { ExistingState } from "./diff";
import { StateDiffEngine } from "./diff";

export class StateStore {
  private readonly engine = new StateDiffEngine();
  private readonly currentState = new Map<string, StateModel>();
  private readonly history: StateHistoryEntry[] = [];
  private readonly changes: ChangeRecord[] = [];

  private stateKey(personId: string, domain: string, field: string): string {
    return `${personId}::${domain}::${field}`;
  }

  getCurrentState(personId: string, domain: string, field: string): StateModel | null {
    return this.currentState.get(this.stateKey(personId, domain, field)) ?? null;
  }

  getHistory(personId: string, domain: string, field: string): StateHistoryEntry[] {
    return this.history.filter(
      (h) => h.person_id === personId && h.domain === domain && h.field === field,
    );
  }

  getAllChanges(personId: string): ChangeRecord[] {
    return this.changes.filter((c) => c.person_id === personId);
  }

  apply(input: {
    person_id: string;
    domain: string;
    field: string;
    incoming_value: string;
    incoming_event_time: string;
    incoming_confidence: "confirmed" | "reported" | "inferred" | "unknown" | "contradictory";
    incoming_claim_id: string;
  }): { change: ChangeRecord | null; state: StateModel | null; history: StateHistoryEntry[]; reason?: string } {
    const existing: ExistingState = {
      current: this.getCurrentState(input.person_id, input.domain, input.field),
      history: this.getHistory(input.person_id, input.domain, input.field),
    };

    const result = this.engine.compareState(existing, {
      person_id: input.person_id,
      domain: input.domain as any,
      field: input.field,
      incoming_value: input.incoming_value,
      incoming_event_time: input.incoming_event_time,
      incoming_confidence: input.incoming_confidence,
      incoming_claim_id: input.incoming_claim_id,
    });

    if (result.updated_state) {
      this.currentState.set(this.stateKey(input.person_id, input.domain, input.field), result.updated_state);
    }

    if (result.history_entry) {
      this.history.push(result.history_entry);
    }

    if (result.change) {
      this.changes.push(result.change);
    }

    return {
      change: result.change,
      state: result.updated_state,
      history: result.history_entry ? [result.history_entry] : [],
      reason: result.reason,
    };
  }

  reset(): void {
    this.currentState.clear();
    this.history.length = 0;
    this.changes.length = 0;
  }
}
