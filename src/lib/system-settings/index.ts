/**
 * System Settings Layer — thin facade over settings-governance.
 * Global control plane configuring execution behavior across reasoning, memory,
 * emotion, priority, safety, context systems. Does NOT process data or generate output.
 */
export {
  GOVERNANCE_LAYER_IDENTITY as SYSTEM_SETTINGS_LAYER_IDENTITY,
  GOVERNANCE_LAYER_ONE_LINE_TRUTH as SYSTEM_SETTINGS_ONE_LINE_TRUTH,
  GOVERNANCE_LAYER_PIPELINE_POSITION as SYSTEM_SETTINGS_PIPELINE_POSITION,
  GOVERNANCE_LAYER_FORBIDDEN as SYSTEM_SETTINGS_FORBIDDEN,
  DEFAULT_SOLENOS_SETTINGS,
  DEFAULT_MEMORY_CONTROL_WEIGHTS,
  applySettingsGovernance,
  resolveUserSettings,
  parseSolenOSSettings,
  mergeWithDefaultSettings,
  normalizeSettingsInput,
  deriveMemoryVisibility,
  memoryControlHasActiveWeights,
  toGovernanceLayerPayload,
  runSystemBehaviorGuarantee,
} from "../settings-governance";

export type {
  SolenOSSettings,
  MemoryControl,
  DecisionControl,
  EmotionalControl,
  TimeControl,
  SafetyControl,
  TransparencyControl,
  NotificationControl,
  PrivacyControl,
  SystemMode,
  GovernanceApplicationResult,
  GovernanceLayerPayload,
} from "../settings-governance";
