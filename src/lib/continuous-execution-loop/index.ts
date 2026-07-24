export {
  CONTINUOUS_EXECUTION_IDENTITY,
  EXECUTION_LOOP_PHASES,
  UNIFIED_INPUT_TYPES,
  STATE_UPDATE_OPERATIONS,
  UNCERTAINTY_STATES,
  SYSTEM_MODES,
  EXECUTION_LOOP_DEFINITION,
  MAX_DIFF_SUMMARY_LINES,
  MAX_SURFACED_PRIORITY_ITEMS,
} from "./contract-constants";

export type {
  ExecutionLoopPhase,
  UnifiedInputType,
  StateUpdateOperation,
  UncertaintyState,
  SystemMode,
  RawInputEvent,
  StateDiff,
  UncertaintyRecord,
  IdleRefreshResult,
  ContinuousExecutionLoopLayer,
  ProcessExecutionLoopInput,
  ReprocessLoopInput,
} from "./types";

export {
  classifyUnifiedInput,
  classifyStateOperation,
  resolveSystemMode,
} from "./classify-input";

export { buildRawInputEvent } from "./raw-input-event";

export {
  computeStateDiff,
  diffToSummaryLines,
  diffHasOutputTrigger,
} from "./diff-engine";

export {
  getUncertaintyRecords,
  syncUncertaintyStateMachine,
  getOpenUncertainties,
  recordContextSnapshot,
  getLastContextSnapshot,
  resetContinuousExecutionStore,
} from "./uncertainty-store";

export { runIdleLoop, computeIdleDiff, idleDiffToChanges } from "./idle-loop";

export {
  processContinuousExecutionLoop,
  reprocessContinuousExecutionLoop,
  classifyInputForLoop,
} from "./pipeline";
