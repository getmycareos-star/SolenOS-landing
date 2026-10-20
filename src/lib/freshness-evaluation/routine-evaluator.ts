import type { FreshnessEvaluator, FreshnessAssessment, FreshnessEvaluationContext, FreshnessEvidence } from '../freshness-evaluation/types';
import type { DecisionMemoryEntry } from '../decision-memory/index';
import type { CareInstruction as RoutineInfo } from '../document-intelligence/types';
import type { CareEventRecord } from '../care-events/types';
import { listDecisionMemory } from '../decision-memory';
import { createFreshnessEvidence, createCurrentAssessment, createStaleAssessment, createHistoricalAssessment, createSupersededAssessment, createExpiredAssessment, createUnknownAssessment, createConflictingAssessment, createVerifiedAssessment } from '../freshness-evaluation/types';

/**
 * Domain-specific freshness evaluator for routine information.
 * Implements the routine-specific freshness logic from the specification.
 */
export class RoutineFreshnessEvaluator implements FreshnessEvaluator<RoutineInfo> {
  /**
   * Evaluate the freshness of routine information.
   * 
   * @param routine The routine information to evaluate
   * @param context Evaluation context containing care key and related evidence
   * @returns A freshness assessment for the routine
   */
  async evaluateFreshness(
    routine: RoutineInfo,
    context: FreshnessEvaluationContext
  ): Promise<FreshnessAssessment> {
    const { careKey } = context;
    
    // Load decision memory for the care recipient (for context)
    const decisionEntries = listDecisionMemory(careKey);
    
    // Get routine-related events from context
    const routineEvents = this.getRoutineEvents(context);
    
    // Determine the current routine state
    const currentState = this.determineCurrentRoutineState(
      routine, 
      decisionEntries, 
      routineEvents
    );
    
    // Assess freshness based on current state
    return this.assessRoutineFreshness(
      routine, 
      currentState, 
      decisionEntries, 
      routineEvents
    );
  }
  
  /**
   * Get a human-readable description of what this evaluator handles.
   */
  getDomainDescription(): string {
    return 'Routine information (daily schedules, care routines, habits, procedures, etc.)';
  }
  
  /**
   * Extract routine-related events from context.
   * In a full implementation, this would come from the care record.
   */
  private getRoutineEvents(context: FreshnessEvaluationContext): CareEventRecord[] {
    // For now, return empty array - in reality this would come from context or care record
    return context.relatedEvents?.filter((e: any) => 
      e.event_type === 'routine_change' ||
      e.event_type === 'routine_established' ||
      e.event_type === 'routine_discontinued'
    ) || [];
  }
  
  /**
   * Determine the current routine state from the routine itself and related events.
   * This represents what SolenOS believes is the current routine status.
   */
  private determineCurrentRoutineState(
    routine: RoutineInfo,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): RoutineState {
    // For routines, the current state is determined by whether the routine is still being followed
    // and if there are any events that indicate it has been changed or discontinued
    
    // Check if there are any events that supersede this routine
    const supersedingEvents = this.findSupersedingRoutineEvents(
      routine, 
      events
    );
    
    if (supersedingEvents.length > 0) {
      return {
        status: 'superseded',
        reason: 'Routine has been superseded by a newer routine or care plan change',
        evidence: supersedingEvents.map(e => this.createEvidenceFromCareEvent(e))
      };
    }
    
    // Check if the routine has been discontinued
    const discontinuedEvidence = this.findDiscontinuationEvidence(
      routine, 
      events
    );
    
    if (discontinuedEvidence.length > 0) {
      return {
        status: 'discontinued',
        reason: 'Routine has been discontinued per care plan update',
        evidence: discontinuedEvidence
      };
    }
    
    // Check if there's evidence the routine is not being followed
    const nonComplianceEvidence = this.findNonComplianceEvidence(
      routine, 
      events
    );
    
    if (nonComplianceEvidence.length > 0) {
      return {
        status: 'not_followed',
        reason: 'There is evidence the routine is not being consistently followed',
        evidence: nonComplianceEvidence
      };
    }
    
    // Check if there's evidence the routine is being followed
    const complianceEvidence = this.findComplianceEvidence(
      routine, 
      events
    );
    
    if (complianceEvidence.length > 0) {
      // Check if it's been verified recently
      const verifiedRecently = this.isVerifiedRecently(
        routine, 
        decisions, 
        events
      );
      
      if (verifiedRecently) {
        return {
          status: 'verified',
          reason: 'Routine is being followed and has been recently verified',
          evidence: complianceEvidence
        };
      }
      
      return {
        status: 'followed',
        reason: 'Routine is being followed based on recent evidence',
        evidence: complianceEvidence
      };
    }
    
    // If we have no evidence either way, check if it's time for a routine check
    const timeSinceLastCheck = this.timeSinceLastRoutineCheck(
      routine, 
      events
    );
    
    if (timeSinceLastCheck > 30) { // More than 30 days since last check
      return {
        status: 'needs_verification',
        reason: `No recent verification of routine compliance (>${timeSinceLastCheck} days)`,
        evidence: []
      };
    }
    
    // Default to followed if we have no contradictory evidence
    return {
      status: 'followed',
      reason: 'No evidence suggesting the routine is not being followed',
      evidence: [this.createEvidenceFromRoutineInfo(routine)]
    };
  }
  
  /**
   * Assess the freshness of a routine against the current state.
   */
  private assessRoutineFreshness(
    routine: RoutineInfo,
    currentState: RoutineState,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessAssessment {
    switch (currentState.status) {
      case 'verified':
        return createVerifiedAssessment(
          currentState.evidence,
          `Routine is being followed and has been recently verified`,
          undefined
        );
      
      case 'followed':
        return createCurrentAssessment(
          currentState.evidence,
          `Routine is being followed based on recent evidence`,
          undefined
        );
      
      case 'needs_verification':
        return createStaleAssessment(
          ['LACK_OF_RECENT_CONFIRMATION'],
          currentState.evidence,
          `No recent verification of routine compliance; requires confirmation`,
          undefined
        );
      
       case 'not_followed':
         return createStaleAssessment(
           ['LACK_OF_RECENT_CONFIRMATION'],
           currentState.evidence,
           `There is evidence the routine is not being consistently followed`,
           undefined
         );
      
      case 'discontinued':
        return createHistoricalAssessment(
          currentState.evidence,
          `Routine has been discontinued per care plan update`,
          undefined
        );
      
      case 'superseded':
        return createSupersededAssessment(
          currentState.evidence,
          `Routine has been superseded by a newer routine or care plan change`,
          undefined
        );
      
      case 'unknown':
      default:
        return createUnknownAssessment(
          [],
          `Unable to determine routine status; requires verification`,
          undefined
        );
    }
  }
  
  /**
   * Check if there's evidence the routine is being followed.
   */
  private findComplianceEvidence(
    routine: RoutineInfo,
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const evidence: FreshnessEvidence[] = [];
    const routineName = routine.description.toLowerCase();
    
    // Look for care events that indicate routine compliance
    for (const event of events) {
      const eventText = (event.content ?? '').toLowerCase();
      
      // Look for explicit mentions of following the routine
      if (eventText.includes(routineName) && 
          (eventText.includes('followed') || 
           eventText.includes('completed') || 
           eventText.includes('did') || 
           eventText.includes('was done'))) {
        evidence.push(this.createEvidenceFromCareEvent(event));
      }
      
      // Look for events that are direct evidence of routine performance
      // (e.g., vital signs taken, medications administered as per routine)
      if (['vital_signs_taken', 'medication_administered', 'exercise_completed'].includes(
        event.event_type as any
      )) {
        // Check if this event matches the routine
        if (this.doesEventMatchRoutine(event, routine)) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
    }
    
    return evidence;
  }
  
  /**
   * Check if there's evidence the routine is not being followed.
   */
  private findNonComplianceEvidence(
    routine: RoutineInfo,
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const evidence: FreshnessEvidence[] = [];
    const routineName = routine.description.toLowerCase();
    
    // Look for care events that indicate routine non-compliance
    for (const event of events) {
      const eventText = (event.content ?? '').toLowerCase();
      
      // Look for explicit mentions of not following the routine
      if (eventText.includes(routineName) && 
          (eventText.includes('did not') || 
           eventText.includes('missed') || 
           eventText.includes('skipped') || 
           eventText.includes('forgot'))) {
        evidence.push(this.createEvidenceFromCareEvent(event));
      }
      
      // Look for events that contradict the routine
      // (e.g., vital signs outside expected range for a monitoring routine)
      if (this.doesEventContradictRoutine(event, routine)) {
        evidence.push(this.createEvidenceFromCareEvent(event));
      }
    }
    
    return evidence;
  }
  
  /**
   * Check if an event contradicts a routine.
   */
  private doesEventContradictRoutine(event: CareEventRecord, routine: RoutineInfo): boolean {
    // This is simplified - in reality, we would have structured data to compare
    // For now, we'll return false as a placeholder
    return false;
  }
  
  /**
   * Check if an event matches a routine.
   */
  private doesEventMatchRoutine(event: CareEventRecord, routine: RoutineInfo): boolean {
    // This is simplified - in reality, we would have structured data to compare
    // For now, we'll return false as a placeholder
    return false;
  }
  
  /**
   * Find events that supersede a routine (e.g., a newer routine).
   */
  private findSupersedingRoutineEvents(
    routine: RoutineInfo,
    events: CareEventRecord[]
  ): CareEventRecord[] {
    // For simplicity, we'll consider any routine change event with a more recent timestamp
    // as potentially superseding
    
    const routineTime = this.extractRoutineTime(routine);
    if (!routineTime) return [];
    
    return events.filter(event => {
      if (!['routine_change', 'routine_established', 'care_plan_update'].includes(
        event.event_type as any
      )) return false;
      
      const eventTime = new Date(event.created_at ?? event.occurred_at ?? '');
      return !isNaN(eventTime.getTime()) && eventTime > routineTime;
    });
  }
  
  /**
   * Find evidence that a routine has been discontinued.
   */
  private findDiscontinuationEvidence(
    routine: RoutineInfo,
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const evidence: FreshnessEvidence[] = [];
    const routineName = routine.description.toLowerCase();
    
    // Look for care events that indicate routine discontinuation
     for (const event of events) {
       if ((event.event_type as string) === 'routine_discontinued' ||
           (event.event_type as string) === 'care_plan_update') {
         const eventText = (event.content ?? '').toLowerCase();
        if (eventText.includes(routineName) || 
            eventText.includes('discontinued') || 
            eventText.includes('stopped') ||
            eventText.includes('cancelled')) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
    }
    
    return evidence;
  }
  
  /**
   * Extract a timestamp from routine information.
   */
  private extractRoutineTime(routine: RoutineInfo): Date | null {
    // Try to extract a timestamp from when the routine was established
    // This is very simplified - a real implementation would use proper date parsing
    if (!routine.sourceText) return null;
    
    // Look for date patterns in the source text
    const dateMatch = routine.sourceText.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/);
    if (dateMatch) {
      return new Date(dateMatch[0]);
    }
    
    return null;
  }
  
  /**
   * Check if an appointment has been verified recently.
   */
  private isVerifiedRecently(
    routine: RoutineInfo,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): boolean {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Check decisions
    for (const decision of decisions) {
      const decisionDate = new Date(decision.decision_date);
      if (decisionDate >= thirtyDaysAgo) {
        // Check if this decision is related to our routine
        const decisionText = (decision.decision_description ?? decision.decision ?? '').toLowerCase();
        const routineDesc = routine.description.toLowerCase();
        if (decisionText.includes(routineDesc.substring(0, Math.min(20, routineDesc.length)))) {
          return true;
        }
      }
    }
    
    // Check events
     for (const event of events) {
       const eventDate = new Date((event.occurred_at ?? event.created_at) ?? '');
       if (eventDate >= thirtyDaysAgo) {
         // Check if this event is related to our routine
         const eventText = (event.content ?? '').toLowerCase();
        const routineDesc = routine.description.toLowerCase();
        if (eventText.includes(routineDesc.substring(0, Math.min(20, routineDesc.length)))) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Calculate time since last routine check.
   */
  private timeSinceLastRoutineCheck(
    routine: RoutineInfo,
    events: CareEventRecord[]
  ): number {
    // Find the most recent event related to this routine
    const routineEvents = events.filter(event => 
      this.isEventRelatedToRoutine(event, routine)
    );
    
    if (routineEvents.length === 0) {
      // No events related to this routine - return a large number
      return 999;
    }
    
    // Find the most recent event
     const mostRecentEvent = routineEvents.reduce((latest, event) => {
       const eventDate = new Date((event.occurred_at ?? event.created_at) ?? '');
       const latestDate = new Date((latest.occurred_at ?? latest.created_at) ?? '');
       return eventDate > latestDate ? event : latest;
     });
    
     const eventDate = new Date((mostRecentEvent.occurred_at ?? mostRecentEvent.created_at) ?? '');
     const now = new Date();
    
    // Calculate difference in days
    const diffTime = Math.abs(now.getTime() - eventDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
  
  /**
   * Check if an event is related to a routine.
   */
  private isEventRelatedToRoutine(
    event: CareEventRecord,
    routine: RoutineInfo
  ): boolean {
    const routineName = routine.description.toLowerCase();
    const eventText = (event.content ?? '').toLowerCase();
    
    // Check if the event mentions the routine
    return eventText.includes(routineName.substring(0, Math.min(10, routineName.length)));
  }
  
  /**
   * Create freshness evidence from a routine info.
   */
  private createEvidenceFromRoutineInfo(routine: RoutineInfo): FreshnessEvidence {
    return createFreshnessEvidence(
      `${routine.description}-${routine.sourceText?.substring(0, 20) ?? 'no-source'}`,
      'routine_info',
      routine.sourceText ?? '',
      `Routine: ${routine.description}`,
      0.9
    );
  }
  
  /**
   * Create freshness evidence from a care event.
   */
  private createEvidenceFromCareEvent(event: CareEventRecord): FreshnessEvidence {
    return createFreshnessEvidence(
      event.id,
      `routine_event_${event.event_type}`,
      event.created_at,
      `Routine event: ${event.event_type} - ${event.content.substring(0, Math.min(50, event.content.length))}`,
      0.8
    );
  }
}

/**
 * Internal representation of the current routine state.
 */
interface RoutineState {
  status: 'followed' | 'verified' | 'needs_verification' | 'not_followed' | 'discontinued' | 'superseded' | 'unknown';
  reason: string;
  evidence: FreshnessEvidence[];
}