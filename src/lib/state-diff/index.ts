export type {
  StateDomain,
  StateField,
  ChangeType,
  ChangeRecord,
  StateHistoryEntry,
  StateModel,
  CompareStateInput,
  CompareStateResult,
  StateDiffEngineOptions,
} from "./types";

export { StateDiffEngine } from "./diff";
export type { DiffEngine, ExistingState } from "./diff";
export { StateStore } from "./store";
