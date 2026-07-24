export {
  DEGRADED_MIN_EVENTS,
  EDGE_STATE_CLASSIFICATION_ORDER,
  EDGE_STATE_DEFINING_PRINCIPLE,
  EDGE_STATE_IDENTITY,
  EDGE_STATE_RULES,
  EDGE_STATES,
  STALE_THRESHOLD_DAYS,
} from "./contract-constants";
export type {
  EdgeState,
  EdgeStateResult,
  EngineActivation,
  OutputRestrictions,
  ProcessEdgeStateInput,
} from "./types";
export { classifyEdgeState, processEdgeState } from "./pipeline";
