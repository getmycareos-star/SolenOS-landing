export {
  UI_RUNTIME_IDENTITY,
  UI_RUNTIME_ONE_LINE_TRUTH,
  UI_EVENT_LOOP_STAGES,
  DECISION_RISK_LEVELS,
  SITUATION_STATUSES,
  TIMELINE_ENTRY_TYPES,
  DOCUMENT_SOURCE_TYPES,
  SIDEBAR_SECTION_IDS,
  CAREGIVER_SIDEBAR_SECTION_IDS,
  OPS_SIDEBAR_SECTION_IDS,
  SIDEBAR_SECTION_LABELS,
  CAREGIVER_SIDEBAR_SECTION_LABELS,
  FEEDBACK_CORRECTION_KINDS,
  FORBIDDEN_UI_PATTERNS,
  UI_RUNTIME_DESIGN_PRINCIPLE,
  TIMELINE_STORAGE_KEY,
  SITUATIONS_STORAGE_KEY,
  ACTIVE_SITUATION_STORAGE_KEY,
} from "./contract-constants";

export type {
  DecisionRiskLevel,
  SituationStatus,
  TimelineEntryType,
  DocumentSourceType,
  SidebarSectionId,
  FeedbackCorrectionKind,
  UiEventLoopStage,
  DecisionCard,
  DecisionSurfaceDemand,
  DecisionSurface,
  TimelineEntry,
  TimelineLog,
  ActiveSituation,
  Situation,
  SituationDocument,
  CareProfileView,
  CareContextView,
  MemoryView,
  ResponsibilityGraphView,
  SafetySettingsView,
  SystemSettingsView,
  FeedbackCorrection,
  SystemHealthView,
  AboutSolenOSView,
  InputBarState,
  SolenOSUI,
  UiRuntimeState,
} from "./types";

export {
  mapSolenOSToDecisionCard,
  mapRiskLevel,
  splitOperationalLines,
  type MapDecisionCardParams,
} from "./decision-mapper";

export {
  createEmptyTimeline,
  appendTimelineEntry,
  timelineForSituation,
  serializeTimeline,
  parseTimeline,
  loadTimelineFromStorage,
  persistTimeline,
  TIMELINE_MUTATION_FORBIDDEN,
  type AppendTimelineParams,
} from "./timeline-store";

export {
  createSituation,
  toActiveSituation,
  listActiveSituations,
  upsertSituation,
  updateSituationFromDecision,
  titleFromInput,
  loadSituationsFromStorage,
  persistSituations,
  loadActiveSituationId,
  persistActiveSituationId,
} from "./situation-store";

export {
  openSituationsFromSituationApi,
  type SituationApiContinuityPayload,
} from "./open-situations";

export {
  applyInferenceCycle,
  createEmptyUiRuntimeState,
  assertSingleActiveDecisionCard,
  type InferenceCycleInput,
  type InferenceCycleResult,
} from "./event-loop";

export {
  buildCareProfileView,
  enrichCareProfileFromDefaults,
  buildCareContextView,
  buildMemoryView,
  buildResponsibilityGraphView,
  buildSafetySettingsView,
  buildSystemSettingsView,
  buildSystemHealthView,
  buildAboutSolenOSView,
} from "./sidebar-adapters";
