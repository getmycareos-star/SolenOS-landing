/**
 * Caregiver-facing files allowed under src/components/mvp-workspace.
 * Everything else (engine dumps, provenance, decay, signals) belongs in ops-devtools.
 */

export const CAREGIVER_MVP_WORKSPACE_FILES = [
  "CognitiveWorkspace.tsx",
  "AccessibilitySettings.tsx",
  "ActivationOutputPanel.tsx",
  "AddSituationPanel.tsx",
  "CareRecipientNameGate.tsx",
  "ConsentGatePanel.tsx",
  "ContinuityHomePanel.tsx",
  "HelpImproveSolenos.tsx",
  "LivingCareRecordPanel.tsx",
  "PolicySettingsPanel.tsx",
  "ResearchPreviewAckGate.tsx",
  "SituationResponsePanel.tsx",
  "UnderstandingFeedbackPrompt.tsx",
  "capture",
  "index.ts",
] as const;

export const OPS_DEVTOOLS_ENGINE_PANELS_NOTE =
  "Engine panels quarantine: src/components/ops-devtools (+ ObservationPanel signals). Never import from caregiver CognitiveWorkspace.";
