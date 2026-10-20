/**
 * Routine Moments Module — Main Entry Point
 * 
 * This is the main entry point for the routine moments module.
 * It re-exports all public APIs for convenience.
 */

// Re-export types
export * from './types';

// Re-export store functionality
export * from './store';

// Re-export postgres store functionality
export * from './postgres-store';

// Re-export service functions
export * from './service';

// Re-export builder functions
export * from './builder';

// Export the types for external consumption
export type {
  RoutineMomentRecord,
  RoutineMomentObservation,
  RoutineMomentChange,
  RoutineBaseline,
  RoutineMomentType,
  RoutineObservationState,
  AssistanceLevel,
  ParticipationLevel,
  RoutineFrequency,
  ConfidenceLevel,
  SourceType
} from './types';