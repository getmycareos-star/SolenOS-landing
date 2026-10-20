        
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { 
  AttentionItem, 
  CreateAttentionItemInput, 
  UpdateAttentionItemInput,
  AttentionItemsResponse,
  AttentionItemResult,
  AttentionState
} from './types';
import type { CareContext } from '../care-context/types';
import type { OpenLoop } from '../open-loop-manager/types';
import type { CanonicalCareEvent } from '../../situation-entry/types';
import type { CareContextRoot } from '../../situation-entry/types';
import { trackOpenLoop } from '../open-loop-manager/index';
import { getOrCreateCareContextRoot, appendEventsToContext } from '../../situation-entry/context-store';
import { computeResponsibilityLoads } from '../responsibility-graph/load';
import { getUserResponsibilityGraphState } from '../responsibility-graph';
import { evaluateDemandOwnership } from '../responsibility-graph/ownership';
import { createCareJourneyEvent } from '../care-journey/store';
import { inferCareJourneyCategory, inferCareJourneyTitle, inferCareJourneyType } from '../care-journey/classify';
import { getCareJourneyEvent, listCareJourneyEventsForCaregiver } from '../care-journey/store';
import { addEventToGraph, getOrCreateGraph, getGraph } from '../care-journey-graph/graph-store';
import { detectRelationships, relatedEventIds } from '../care-journey-graph/detect-relationships';
import { assessContinuity } from '../care-journey-graph/continuity-assess';
import { classifyJourneyEventType, journeyCategoryFromType } from '../care-journey-graph/classify-event';
import { extractPipelineFacts } from '../care-journey-graph/structure-event';
import { FreshnessEvaluationManager } from '../freshness-evaluation';
import { freshnessManager } from '../freshness-evaluation';
import type { FreshnessAssessment } from '../freshness-evaluation/types';
// OpenTelemetry imports
import { context, trace } from '@opentelemetry/api';
import { getTracer } from '../../telemetry/index';

/**
 * Care Attention Service - Core business logic for managing what deserves caregiver attention
 * 
 * Implements Specification Chapter 11: "WHAT MATTERS?" — THE CARE ATTENTION LAYER
 * 
 * ENHANCED WITH:
 * 1. Complete Freshness Evaluator Suite (medication, appointment, routine, caregiver, professional)
 * 2. Closed-Loop Integration with Open-Loop Manager
 * 3. Responsibility-Graph Weighted Attention
 * 4. Temporal Trend Analysis via Care-Journey Engine
 * 
 * This service determines what deserves the caregiver's attention based on:
 * - Evidence, change, uncertainty, unresolved continuity, timing, and user-defined importance
 * - Does NOT independently determine clinical severity, diagnosis, urgency, or medical appropriateness
 */
export class CareAttentionService {
  private db: Pool;
  private tracer: trace.Tracer;

  constructor(db: Pool) {
    this.db = db;
    this.tracer = getTracer('solenos-care-attention-service', '0.1.0');
  }

  /**
   * Main entry point - determines what deserves attention now
   * Per Specification: "Given what we currently know about this care situation, 
   * what deserves the caregiver's attention now?"
   * 
   * ENHANCED: Now creates open loops, uses responsibility weighting, and analyzes trends
   */
   async determineWhatMatters(
     careRecipientId: string,
     caregiverId: string
   ): Promise<AttentionItemsResponse> {
     return this.tracer.startActiveSpan('care-attention.determine-what-matters', async (span) => {
       try {
         // Set attributes for the span
         span.setAttribute('care-attention.operation', 'determine_what_matters');
         span.setAttribute('care-recipient-id', careRecipientId);
         span.setAttribute('caregiver-id', caregiverId);
         
         // 1. Reconstruct current situation and identify meaningful changes
         const currentContext = await this.getCurrentCareContext(careRecipientId, caregiverId);
         const previousContext = await this.getPreviousCareContext(careRecipientId, caregiverId);
         
         // 2. Identify meaningful changes (not just event dumps)
         const meaningfulChanges = await this.identifyMeaningfulChanges(
           currentContext, 
           previousContext
         );
         
         // 3. Identify unresolved items (Open Loops) - ENHANCED: Also create new open loops for stale/missing info
         const unresolvedItems = await this.getUnresolvedOpenLoops(careRecipientId, caregiverId);
         const staleInformation = await this.identifyStaleInformation(currentContext);
         const missingInformation = await this.identifyMissingInformation(currentContext);
         
         // 4. Create open loops for stale/missing information (Closed-Loop Integration)
         await this.createOpenLoopsForStaleInfo(staleInformation, careRecipientId, caregiverId);
         await this.createOpenLoopsForMissingInfo(missingInformation, careRecipientId, caregiverId);
         
         // 5. Identify upcoming appointments
         const upcomingAppointments = await this.getUpcomingAppointments(careRecipientId, caregiverId);
         
         // 6. Identify stale information
         // (already done above for open loop creation)
         
         // 7. Identify conflicts
         const conflicts = await this.identifyConflicts(currentContext);
         
         // 8. Identify missing information
         // (already done above for open loop creation)
         
         // 9. Process recent information
         const recentInformation = await this.processRecentInformation(currentContext);
         
         // 10. Enhance with temporal trend analysis (Care-Journey Engine)
         const enhancedRecentInfo = await this.enhanceWithTemporalTrends(
           recentInformation, 
           careRecipientId, 
           caregiverId
         );
         
         // 11. Convert to attention items and categorize with responsibility weighting
         const attentionItems = await this.createAndWeightAttentionItems([
           ...meaningfulChanges,
           ...unresolvedItems,
           ...upcomingAppointments,
           ...staleInformation,
           ...conflicts,
           ...missingInformation,
           ...enhancedRecentInfo
         ], careRecipientId, caregiverId);
         
         // 12. Categorize attention items
         const result = this.categorizeAttentionItems(attentionItems);
         
         // Set result attributes on span
         span.setAttribute('care-attention.result.needs-attention-count', result.needsAttention.length);
         span.setAttribute('care-attention.result.awaiting-confirmation-count', result.awaitingConfirmation.length);
         span.setAttribute('care-attention.result.professional-followup-count', result.professionalFollowUp.length);
         
         span.setStatus({
           code: trace.SpanStatusCode.OK
         });
         
         return result;
       } catch (error) {
         span.recordException(error as Error);
         span.setStatus({
           code: trace.SpanStatusCode.ERROR,
           message: error instanceof Error ? error.message : String(error)
         });
         throw error;
       }
     });
   }

  /**
   * Get current care context for a care recipient
   */
  private async getCurrentCareContext(
    careRecipientId: string,
    caregiverId: string
  ): Promise<CareContext | null> {
    return this.tracer.startActiveSpan('database.query.get_current_care_context', async (span) => {
      try {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.user', process.env.POSTGRES_USER || 'unknown');
        span.setAttribute('db.name', process.env.POSTGRES_DB || 'unknown');
        span.setAttribute('db.operation', 'SELECT');
        span.setAttribute('db.table', 'care_contexts');
        span.setAttribute('db.statement', 'SELECT * FROM care_contexts WHERE care_recipient_id = $1 AND caregiver_id = $2 ORDER BY updated_at DESC LIMIT 1');
        
        const result = await this.db.query(
          'SELECT * FROM care_contexts WHERE care_recipient_id = $1 AND caregiver_id = $2 ORDER BY updated_at DESC LIMIT 1',
          [careRecipientId, caregiverId]
        );
        
        span.setAttribute('db.rows_returned', result.rows.length);
        span.setStatus({
          code: trace.SpanStatusCode.OK
        });
        
        return result.rows[0] ?? null;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: trace.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
  }

  /**
   * Get previous care context for a care recipient
   */
  private async getPreviousCareContext(
    careRecipientId: string,
    caregiverId: string
  ): Promise<CareContext | null> {
    return this.tracer.startActiveSpan('database.query.get_previous_care_context', async (span) => {
      try {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.user', process.env.POSTGRES_USER || 'unknown');
        span.setAttribute('db.name', process.env.POSTGRES_DB || 'unknown');
        span.setAttribute('db.operation', 'SELECT');
        span.setAttribute('db.table', 'care_contexts');
        span.setAttribute('db.statement', 'SELECT * FROM care_contexts WHERE care_recipient_id = $1 AND caregiver_id = $2 ORDER BY updated_at DESC LIMIT 1 OFFSET 1');
        
        const result = await this.db.query(
          'SELECT * FROM care_contexts WHERE care_recipient_id = $1 AND caregiver_id = $2 ORDER BY updated_at DESC LIMIT 1 OFFSET 1',
          [careRecipientId, caregiverId]
        );
        
        span.setAttribute('db.rows_returned', result.rows.length);
        span.setStatus({
          code: trace.SpanStatusCode.OK
        });
        
        return result.rows[0] ?? null;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: trace.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
  }

  /**
   * Identify meaningful changes by comparing previous vs current context
   * Per Specification: "This question must be answered from actual state comparison.
   * It should not produce a chronological event dump."
   * 
   * ENHANCED: Now incorporates freshness evaluation data from all domains
   */
  private async identifyMeaningfulChanges(
    currentContext: CareContext | null,
    previousContext: CareContext | null
  ): Promise<Array<{ 
    change: string; 
    evidence: string[]; 
    reason: string; 
    confidence: string;
    domain: string; // ENHANCED: Track domain for responsibility weighting
    freshnessData?: FreshnessAssessment // ENHANCED: Include freshness data
  }>> {
    
    if (!currentContext || !previousContext) {
      return [];
    }
 
    const changes: Array<{ 
      change: string; 
      evidence: string[]; 
      reason: string; 
      confidence: string;
      domain: string;
      freshnessData?: FreshnessAssessment
    }> = [];

    // Compare timeline events for meaningful changes
    // Per spec: "Five routine notes should not automatically outrank one meaningful unresolved continuity issue."
    
    // ENHANCED: Use freshness evaluation for more nuanced change detection
    const freshnessAssessment = await freshnessManager.evaluateFreshness({
      context: currentContext ?? { events: [] },
      referenceContext: previousContext ?? { events: [] },
      timestamp: new Date().toISOString()
    });
    
    // Process freshness data for each domain
    if (freshnessAssessment.domainAssessments) {
      for (const [domain, assessment] of Object.entries(freshnessAssessment.domainAssessments)) {
        if (assessment.stalenessLevel > 0.5 || assessment.changeDetected) {
          changes.push({
            change: `${domain}: ${assessment.summary}`,
            evidence: [currentContext?.id?.toString() ?? 'unknown'],
            reason: `Freshness detection: ${assessment.reason}`,
            confidence: assessment.confidence,
            domain: domain as string,
            freshnessData: assessment
          });
        }
      }
    }

    // Compare timeline events for meaningful changes (original logic preserved)
    if (currentContext.timeline_events && previousContext.timeline_events) {
      // Compare medication changes
      const currentMeds = this.extractMedications(currentContext.timeline_events);
      const previousMeds = this.extractMedications(previousContext.timeline_events);
      
      const newMeds = currentMeds.filter(med => !previousMeds.includes(med));
      const stoppedMeds = previousMeds.filter(med => !currentMeds.includes(med));
      
      if (newMeds.length > 0) {
        changes.push({
          change: `New medication(s) started: ${newMeds.join(', ')}`,
          evidence: [currentContext.id.toString()],
          reason: 'Medication change detected',
          confidence: 'high',
          domain: 'medication_adherence'
        });
      }
      
      if (stoppedMeds.length > 0) {
        changes.push({
          change: `Medication(s) stopped: ${stoppedMeds.join(', ')}`,
          evidence: [currentContext.id.toString()],
          reason: 'Medication change detected',
          confidence: 'high',
          domain: 'medication_adherence'
        });
      }
      
      // Compare vital signs or measurements
      const currentVitals = this.extractVitalSigns(currentContext.timeline_events);
      const previousVitals = this.extractVitalSigns(previousContext.timeline_events);
      
      // Check for significant changes in blood pressure, weight, etc.
      if (this.hasSignificantVitalChange(currentVitals, previousVitals)) {
        changes.push({
          change: 'Significant vital sign change detected',
          evidence: [currentContext.id.toString()],
          reason: 'Vital sign deviation from baseline',
          confidence: 'medium',
          domain: 'vital_signs'
        });
      }
    }

    return changes;
  }
}
        
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { 
  AttentionItem, 
  CreateAttentionItemInput, 
  UpdateAttentionItemInput,
  AttentionItemsResponse,
  AttentionItemResult,
  AttentionState
} from './types';
import type { CareContext } from '../care-context/types';
import type { OpenLoop } from '../open-loop-manager/types';
import type { CanonicalCareEvent } from '../../situation-entry/types';
import type { CareContextRoot } from '../../situation-entry/types';
import { trackOpenLoop } from '../open-loop-manager/index';
import { getOrCreateCareContextRoot, appendEventsToContext } from '../../situation-entry/context-store';
import { computeResponsibilityLoads } from '../responsibility-graph/load';
import { getUserResponsibilityGraphState } from '../responsibility-graph';
import { evaluateDemandOwnership } from '../responsibility-graph/ownership';
import { createCareJourneyEvent } from '../care-journey/store';
import { inferCareJourneyCategory, inferCareJourneyTitle, inferCareJourneyType } from '../care-journey/classify';
import { getCareJourneyEvent, listCareJourneyEventsForCaregiver } from '../care-journey/store';
import { addEventToGraph, getOrCreateGraph, getGraph } from '../care-journey-graph/graph-store';
import { detectRelationships, relatedEventIds } from '../care-journey-graph/detect-relationships';
import { assessContinuity } from '../care-journey-graph/continuity-assess';
import { classifyJourneyEventType, journeyCategoryFromType } from '../care-journey-graph/classify-event';
import { extractPipelineFacts } from '../care-journey-graph/structure-event';
import { FreshnessEvaluationManager } from '../freshness-evaluation';
import { freshnessManager } from '../freshness-evaluation';
import type { FreshnessAssessment } from '../freshness-evaluation/types';
// OpenTelemetry imports
import { context, trace } from '@opentelemetry/api';
import { getTracer } from '../../telemetry/index';

/**
 * Care Attention Service - Core business logic for managing what deserves caregiver attention
 * 
 * Implements Specification Chapter 11: "WHAT MATTERS?" — THE CARE ATTENTION LAYER
 * 
 * ENHANCED WITH:
 * 1. Complete Freshness Evaluator Suite (medication, appointment, routine, caregiver, professional)
 * 2. Closed-Loop Integration with Open-Loop Manager
 * 3. Responsibility-Graph Weighted Attention
 * 4. Temporal Trend Analysis via Care-Journey Engine
 * 
 * This service determines what deserves the caregiver's attention based on:
 * - Evidence, change, uncertainty, unresolved continuity, timing, and user-defined importance
 * - Does NOT independently determine clinical severity, diagnosis, urgency, or medical appropriateness
 */
export class CareAttentionService {
  private db: Pool;
  private tracer: trace.Tracer;

  constructor(db: Pool) {
    this.db = db;
    this.tracer = getTracer('solenos-care-attention-service', '0.1.0');
  }

  /**
   * Main entry point - determines what deserves attention now
   * Per Specification: "Given what we currently know about this care situation, 
   * what deserves the caregiver's attention now?"
   * 
   * ENHANCED: Now creates open loops, uses responsibility weighting, and analyzes trends
   */
   async determineWhatMatters(
     careRecipientId: string,
     caregiverId: string
   ): Promise<AttentionItemsResponse> {
     return this.tracer.startActiveSpan('care-attention.determine-what-matters', async (span) => {
       try {
         // Set attributes for the span
         span.setAttribute('care-attention.operation', 'determine_what_matters');
         span.setAttribute('care-recipient-id', careRecipientId);
         span.setAttribute('caregiver-id', caregiverId);
         
         // 1. Reconstruct current situation and identify meaningful changes
         const currentContext = await this.getCurrentCareContext(careRecipientId, caregiverId);
         const previousContext = await this.getPreviousCareContext(careRecipientId, caregiverId);
         
         // 2. Identify meaningful changes (not just event dumps)
         const meaningfulChanges = await this.identifyMeaningfulChanges(
           currentContext, 
           previousContext
         );
         
         // 3. Identify unresolved items (Open Loops) - ENHANCED: Also create new open loops for stale/missing info
         const unresolvedItems = await this.getUnresolvedOpenLoops(careRecipientId, caregiverId);
         const staleInformation = await this.identifyStaleInformation(currentContext);
         const missingInformation = await this.identifyMissingInformation(currentContext);
         
         // 4. Create open loops for stale/missing information (Closed-Loop Integration)
         await this.createOpenLoopsForStaleInfo(staleInformation, careRecipientId, caregiverId);
         await this.createOpenLoopsForMissingInfo(missingInformation, careRecipientId, caregiverId);
         
         // 5. Identify upcoming appointments
         const upcomingAppointments = await this.getUpcomingAppointments(careRecipientId, caregiverId);
         
         // 6. Identify stale information
         // (already done above for open loop creation)
         
         // 7. Identify conflicts
         const conflicts = await this.identifyConflicts(currentContext);
         
         // 8. Identify missing information
         // (already done above for open loop creation)
         
         // 9. Process recent information
         const recentInformation = await this.processRecentInformation(currentContext);
         
         // 10. Enhance with temporal trend analysis (Care-Journey Engine)
         const enhancedRecentInfo = await this.enhanceWithTemporalTrends(
           recentInformation, 
           careRecipientId, 
           caregiverId
         );
         
         // 11. Convert to attention items and categorize with responsibility weighting
         const attentionItems = await this.createAndWeightAttentionItems([
           ...meaningfulChanges,
           ...unresolvedItems,
           ...upcomingAppointments,
           ...staleInformation,
           ...conflicts,
           ...missingInformation,
           ...enhancedRecentInfo
         ], careRecipientId, caregiverId);
         
         // 12. Categorize attention items
         const result = this.categorizeAttentionItems(attentionItems);
         
         // Set result attributes on span
         span.setAttribute('care-attention.result.needs-attention-count', result.needsAttention.length);
         span.setAttribute('care-attention.result.awaiting-confirmation-count', result.awaitingConfirmation.length);
         span.setAttribute('care-attention.result.professional-followup-count', result.professionalFollowUp.length);
         
         span.setStatus({
           code: trace.SpanStatusCode.OK
         });
         
         return result;
       } catch (error) {
         span.recordException(error as Error);
         span.setStatus({
           code: trace.SpanStatusCode.ERROR,
           message: error instanceof Error ? error.message : String(error)
         });
         throw error;
       }
     });
   }

  /**
   * Get current care context for a care recipient
   */
  private async getCurrentCareContext(
    careRecipientId: string,
    caregiverId: string
  ): Promise<CareContext | null> {
    return this.tracer.startActiveSpan('database.query.get_current_care_context', async (span) => {
      try {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.user', process.env.POSTGRES_USER || 'unknown');
        span.setAttribute('db.name', process.env.POSTGRES_DB || 'unknown');
        span.setAttribute('db.operation', 'SELECT');
        span.setAttribute('db.table', 'care_contexts');
        span.setAttribute('db.statement', 'SELECT * FROM care_contexts WHERE care_recipient_id = $1 AND caregiver_id = $2 ORDER BY updated_at DESC LIMIT 1');
        
        const result = await this.db.query(
          'SELECT * FROM care_contexts WHERE care_recipient_id = $1 AND caregiver_id = $2 ORDER BY updated_at DESC LIMIT 1',
          [careRecipientId, caregiverId]
        );
        
        span.setAttribute('db.rows_returned', result.rows.length);
        span.setStatus({
          code: trace.SpanStatusCode.OK
        });
        
        return result.rows[0] ?? null;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: trace.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
  }

  /**
   * Get previous care context for a care recipient
   */
  private async getPreviousCareContext(
    careRecipientId: string,
    caregiverId: string
  ): Promise<CareContext | null> {
    return this.tracer.startActiveSpan('database.query.get_previous_care_context', async (span) => {
      try {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.user', process.env.POSTGRES_USER || 'unknown');
        span.setAttribute('db.name', process.env.POSTGRES_DB || 'unknown');
        span.setAttribute('db.operation', 'SELECT');
        span.setAttribute('db.table', 'care_contexts');
        span.setAttribute('db.statement', 'SELECT * FROM care_contexts WHERE care_recipient_id = $1 AND caregiver_id = $2 ORDER BY updated_at DESC LIMIT 1 OFFSET 1');
        
        const result = await this.db.query(
          'SELECT * FROM care_contexts WHERE care_recipient_id = $1 AND caregiver_id = $2 ORDER BY updated_at DESC LIMIT 1 OFFSET 1',
          [careRecipientId, caregiverId]
        );
        
        span.setAttribute('db.rows_returned', result.rows.length);
        span.setStatus({
          code: trace.SpanStatusCode.OK
        });
        
        return result.rows[0] ?? null;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: trace.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
  }

  /**
   * Identify meaningful changes by comparing previous vs current context
   * Per Specification: "This question must be answered from actual state comparison.
   * It should not produce a chronological event dump."
   * 
   * ENHANCED: Now incorporates freshness evaluation data from all domains
   */
  private async identifyMeaningfulChanges(
    currentContext: CareContext | null,
    previousContext: CareContext | null
  ): Promise<Array<{ 
    change: string; 
    evidence: string[]; 
    reason: string; 
    confidence: string;
    domain: string; // ENHANCED: Track domain for responsibility weighting
    freshnessData?: FreshnessAssessment // ENHANCED: Include freshness data
  }>> {
    
    if (!currentContext || !previousContext) {
      return [];
    }
 
    const changes: Array<{ 
      change: string; 
      evidence: string[]; 
      reason: string; 
      confidence: string;
      domain: string;
      freshnessData?: FreshnessAssessment
    }> = [];

    // Compare timeline events for meaningful changes
    // Per spec: "Five routine notes should not automatically outrank one meaningful unresolved continuity issue."
    
    // ENHANCED: Use freshness evaluation for more nuanced change detection
    const freshnessAssessment = await freshnessManager.evaluateFreshness({
      context: currentContext ?? { events: [] },
      referenceContext: previousContext ?? { events: [] },
      timestamp: new Date().toISOString()
    });
    
    // Process freshness data for each domain
    if (freshnessAssessment.domainAssessments) {
      for (const [domain, assessment] of Object.entries(freshnessAssessment.domainAssessments)) {
        if (assessment.stalenessLevel > 0.5 || assessment.changeDetected) {
          changes.push({
            change: `${domain}: ${assessment.summary}`,
            evidence: [currentContext?.id?.toString() ?? 'unknown'],
            reason: `Freshness detection: ${assessment.reason}`,
            confidence: assessment.confidence,
            domain: domain as string,
            freshnessData: assessment
          });
        }
      }
    }

    // Compare timeline events for meaningful changes (original logic preserved)
    if (currentContext.timeline_events && previousContext.timeline_events) {
      // Compare medication changes
      const currentMeds = this.extractMedications(currentContext.timeline_events);
      const previousMeds = this.extractMedications(previousContext.timeline_events);
      
      const newMeds = currentMeds.filter(med => !previousMeds.includes(med));
      const stoppedMeds = previousMeds.filter(med => !currentMeds.includes(med));
      
      if (newMeds.length > 0) {
        changes.push({
          change: `New medication(s) started: ${newMeds.join(', ')}`,
          evidence: [currentContext.id.toString()],
          reason: 'Medication change detected',
          confidence: 'high',
          domain: 'medication_adherence'
        });
      }
      
      if (stoppedMeds.length > 0) {
        changes.push({
          change: `Medication(s) stopped: ${stoppedMeds.join(', ')}`,
          evidence: [currentContext.id.toString()],
          reason: 'Medication change detected',
          confidence: 'high',
          domain: 'medication_adherence'
        });
      }
      
      // Compare vital signs or measurements
      const currentVitals = this.extractVitalSigns(currentContext.timeline_events);
      const previousVitals = this.extractVitalSigns(previousContext.timeline_events);
      
      // Check for significant changes in blood pressure, weight, etc.
      if (this.hasSignificantVitalChange(currentVitals, previousVitals)) {
        changes.push({
          change: 'Significant vital sign change detected',
          evidence: [currentContext.id.toString()],
          reason: 'Vital sign deviation from baseline',
          confidence: 'medium',
          domain: 'vital_signs'
        });
      }
    }

    return changes;
  /**
  }
   * Extract medications from timeline events
   */
  private extractMedications(events: any[]): string[] {
    const medications: string[] = [];
    const medPattern = /(?:medication|med|pill|dose|prescription)/i;
    
    for (const event of events) {
      if (typeof event === 'string' && medPattern.test(event)) {
        // Extract medication name (simplified)
        const words = event.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (medPattern.test(words[i])) {
            // Look for potential medication name nearby
            if (i > 0 && words[i-1].length > 2) {
              medications.push(words[i-1]);
            }
            if (i < words.length - 1 && words[i+1].length > 2) {
              medications.push(words[i+1]);
            }
          }
        }
      }
    }
    
    return Array.from(new Set(medications)); // Remove duplicates
  }
  /**
   * Calculate priority from confidence level
   * @param confidence - confidence string (high, medium, low)
   * @returns priority number (1-3)
   */
  private calculatePriority(confidence: string): number {
    switch (confidence.toLowerCase()) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 1;
    }
  }
  /**
   * Extract vital signs from timeline events
   */
  private extractVitalSigns(events: any[]): Record<string, number> {
    const vitals: Record<string, number> = {};
    
    for (const event of events) {
      if (typeof event === 'object' && event.vital_signs) {
        // If vital signs are already structured as an object
        Object.assign(vitals, event.vital_signs);
      } else if (typeof event === 'string') {
        // Parse vital signs from text (simplified)
        const bpMatch = event.match(/(\d{2,3})\/(\d{2,3})/);
        if (bpMatch) {
          vitals['systolic_bp'] = parseInt(bpMatch[1], 10);
          vitals['diastolic_bp'] = parseInt(bpMatch[2], 10);
        }
        // TODO: Add other vital sign parsing as needed
      }
    }
    
    return vitals;
  }
  /**
   * Check if there are significant changes in vital signs
   */
  private hasSignificantVitalChange(current: Record<string, number>, previous: Record<string, number>): boolean {
    // Check blood pressure changes
    if (current['systolic_bp'] && previous['systolic_bp']) {
      const systolicChange = Math.abs(current['systolic_bp'] - previous['systolic_bp']);
      if (systolicChange > 10) { // Significant if change > 10 mmHg
        return true;
      }
    }
    
    if (current['diastolic_bp'] && previous['diastolic_bp']) {
      const diastolicChange = Math.abs(current['diastolic_bp'] - previous['diastolic_bp']);
      if (diastolicChange > 5) { // Significant if change > 5 mmHg
        return true;
      }
    }
    
    // TODO: Add checks for other vital signs as needed
    
    return false;
  }
  }
}
