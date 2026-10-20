// Export types and creation functions from types.ts
export type { FreshnessState, StalenessReason, FreshnessEvidence, FreshnessAssessment, FreshnessWrapper, FreshnessEvaluationContext, FreshnessEvaluator } from './types';
export { createFreshnessEvidence, createCurrentAssessment, createStaleAssessment, createHistoricalAssessment, createSupersededAssessment, createExpiredAssessment, createUnknownAssessment, createConflictingAssessment, createVerifiedAssessment, createStoredAssessment } from './types';
// Import the evaluator classes and the manager class
import { MedicationFreshnessEvaluator } from './medication-evaluator';
import { AppointmentFreshnessEvaluator } from './appointment-evaluator';
import { RoutineFreshnessEvaluator } from './routine-evaluator';
import { CaregiverFreshnessEvaluator } from './caregiver-evaluator';
import { ProfessionalFreshnessEvaluator } from './professional-evaluator';
import { FreshnessEvaluationManager } from './manager';
// Export the evaluator classes and the manager class
export { MedicationFreshnessEvaluator, AppointmentFreshnessEvaluator, RoutineFreshnessEvaluator, CaregiverFreshnessEvaluator, ProfessionalFreshnessEvaluator, FreshnessEvaluationManager };
// Create and export an instance of the manager
const freshnessManager = new FreshnessEvaluationManager();
// Register the evaluators
freshnessManager.registerEvaluator('medication', new MedicationFreshnessEvaluator());
freshnessManager.registerEvaluator('appointment', new AppointmentFreshnessEvaluator());
freshnessManager.registerEvaluator('routine', new RoutineFreshnessEvaluator());
freshnessManager.registerEvaluator('caregiver', new CaregiverFreshnessEvaluator());
freshnessManager.registerEvaluator('professional', new ProfessionalFreshnessEvaluator());
// Export the manager instance
export { freshnessManager };