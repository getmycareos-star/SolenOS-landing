export {
  MVP_SURFACE_IDENTITY,
  MVP_CORE_THESIS,
  MVP_FIRST_SCREEN_PROMPT,
  MVP_NON_GOALS,
  MVP_SYSTEM_STATES,
  AHA_MOMENT_SECTIONS,
  POST_ENTRY_PRIORITY_ORDER,
  MVP_SUCCESS_CRITERIA,
  POST_ENTRY_SYSTEM_DEFINITION,
} from "./contract-constants";

export type {
  MvpSystemState,
  AhaMomentSection,
  AhaMomentView,
  PostEntryPriorityKind,
  PrioritySurfaceItem,
  SinceLastVisitDelta,
  ContinuityHomeView,
  PostEntryBehavior,
  MvpSuccessCriteriaStatus,
  MvpSurfaceAreaLayer,
  ProcessMvpSurfaceInput,
} from "./types";

export { buildAhaMomentView } from "./aha-moment";
export { buildContinuityHomeView, buildPostEntryBehavior } from "./continuity-home";
export {
  processMvpSurfaceArea,
  resolveMvpSystemState,
} from "./pipeline";
export { getLastMvpVisit, recordMvpVisit, resetMvpSurfaceStore } from "./store";
