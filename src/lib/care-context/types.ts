/** Longitudinal understanding of a family's care journey. */
export interface CareContext {
  identity?: {
    patientName?: string;
    contextLabel?: string;
    caregiverId?: string; // Added for pattern recognition and caregiver-specific operations
  };
  timeline: ContextCareEvent[];
  recentChanges: ChangeRecord[];
  uncertainties: string[];
  prioritizedActions: PrioritizedAction[];
  /** Cached engine outputs — recomputed on context update. */
  stateOfCare?: StateOfCare;
  caregiverLoad?: CaregiverLoadAssessment;
  patterns?: PatternObservation[];
  /** Decision Memory — longitudinal tracking of care decisions and their reasoning. */
  decisions?: DecisionMemoryEntry[];
  /** Outcome Measurement Layer — emitted on every context update. */
  oml?: OutcomeMeasurementResult;
  updatedAt: string;
}