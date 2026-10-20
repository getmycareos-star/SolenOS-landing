import type { FreshnessEvaluator, FreshnessAssessment, FreshnessEvaluationContext, FreshnessEvidence } from '../freshness-evaluation/types';
import type { DecisionMemoryEntry } from '../decision-memory/index';
import type { CarePerson as CaregiverInfo } from '../document-intelligence/types';
import type { CareEventRecord } from '../care-events/types';
import { listDecisionMemory } from '../decision-memory';
import { createFreshnessEvidence, createCurrentAssessment, createStaleAssessment, createHistoricalAssessment, createSupersededAssessment, createExpiredAssessment, createUnknownAssessment, createConflictingAssessment, createVerifiedAssessment } from '../freshness-evaluation/types';

/**
 * Domain-specific freshness evaluator for caregiver information.
 * Implements the caregiver-specific freshness logic from the specification.
 */
export class CaregiverFreshnessEvaluator implements FreshnessEvaluator<CaregiverInfo> {
  /**
   * Evaluate the freshness of caregiver information.
   * 
   * @param caregiver The caregiver information to evaluate
   * @param context Evaluation context containing care key and related evidence
   * @returns A freshness assessment for the caregiver
   */
  async evaluateFreshness(
    caregiver: CaregiverInfo,
    context: FreshnessEvaluationContext
  ): Promise<FreshnessAssessment> {
    const { careKey } = context;
    
    // Load decision memory for the care recipient (for context)
    const decisionEntries = listDecisionMemory(careKey);
    
    // Get caregiver-related events from context
    const caregiverEvents = this.getCaregiverEvents(context);
    
    // Determine the current caregiver state
    const currentState = this.determineCurrentCaregiverState(
      caregiver, 
      decisionEntries, 
      caregiverEvents
    );
    
    // Assess freshness based on current state
    return this.assessCaregiverFreshness(
      caregiver, 
      currentState, 
      decisionEntries, 
      caregiverEvents
    );
  }
  
  /**
   * Get a human-readable description of what this evaluator handles.
   */
  getDomainDescription(): string {
    return 'Caregiver information (contact details, availability, capabilities, limitations, etc.)';
  }
  
  /**
   * Extract caregiver-related events from context.
   * In a full implementation, this would come from the care record.
   */
  private getCaregiverEvents(context: FreshnessEvaluationContext): CareEventRecord[] {
    // For now, return empty array - in reality this would come from context or care record
    return context.relatedEvents?.filter((e: any) => 
      e.event_type === 'caregiver_change' ||
      e.event_type === 'caregiver_assigned' ||
      e.event_type === 'caregiver_unavailable' ||
      e.event_type === 'caregiver_available'
    ) || [];
  }
  
  /**
   * Determine the current caregiver state from the caregiver info and related events.
   * This represents what SolenOS believes is the current caregiver status.
   */
  private determineCurrentCaregiverState(
    caregiver: CaregiverInfo,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): CaregiverState {
    // Check if there are any events that supersede this caregiver info
    const supersedingEvents = this.findSupersedingCaregiverEvents(
      caregiver, 
      events
    );
    
    if (supersedingEvents.length > 0) {
      return {
        status: 'superseded',
        reason: 'Caregiver information has been superseded by a more recent update',
        evidence: supersedingEvents.map(e => this.createEvidenceFromCareEvent(e))
      };
    }
    
    // Check if the caregiver has become unavailable
    const unavailabilityEvidence = this.findUnavailabilityEvidence(
      caregiver, 
      events
    );
    
    if (unavailabilityEvidence.length > 0) {
      return {
        status: 'unavailable',
        reason: 'Caregiver is currently unavailable per recent updates',
        evidence: unavailabilityEvidence
      };
    }
    
    // Check if there's evidence the caregiver is available and active
    const availabilityEvidence = this.findAvailabilityEvidence(
      caregiver, 
      events
    );
    
    if (availabilityEvidence.length > 0) {
      // Check if it's been verified recently
      const verifiedRecently = this.isVerifiedRecently(
        caregiver, 
        decisions, 
        events
      );
      
      if (verifiedRecently) {
        return {
          status: 'verified',
          reason: 'Caregiver information is current and has been recently verified',
          evidence: availabilityEvidence
        };
      }
      
      return {
        status: 'current',
        reason: 'Caregiver information is current based on recent evidence',
        evidence: availabilityEvidence
      };
    }
    
    // If we have no evidence either way, check if it's time for a caregiver check
    const timeSinceLastCheck = this.timeSinceLastCaregiverCheck(
      caregiver, 
      events
    );
    
    if (timeSinceLastCheck > 60) { // More than 60 days since last check
      return {
        status: 'needs_verification',
        reason: `No recent verification of caregiver status (>${timeSinceLastCheck} days)`,
        evidence: []
      };
    }
    
    // Default to current if we have no contradictory evidence
    return {
      status: 'current',
      reason: 'No evidence suggesting the caregiver information has changed',
      evidence: [this.createEvidenceFromCaregiverInfo(caregiver)]
    };
  }
  
  /**
   * Assess the freshness of caregiver information against the current state.
   */
  private assessCaregiverFreshness(
    caregiver: CaregiverInfo,
    currentState: CaregiverState,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessAssessment {
    switch (currentState.status) {
      case 'verified':
        return createVerifiedAssessment(
          currentState.evidence,
          `Caregiver information is current and has been recently verified`,
          undefined
        );
      
      case 'current':
        return createCurrentAssessment(
          currentState.evidence,
          `Caregiver information is current based on recent evidence`,
          undefined
        );
      
      case 'needs_verification':
        return createStaleAssessment(
          ['LACK_OF_RECENT_CONFIRMATION'],
          currentState.evidence,
          `No recent verification of caregiver status; requires confirmation`,
          undefined
        );
      
      case 'unavailable':
        return createStaleAssessment(
          ['SOURCE_LIMITED_VALIDITY'],
          currentState.evidence,
          `Caregiver is currently unavailable per recent updates`,
          undefined
        );
      
      case 'superseded':
        return createSupersededAssessment(
          currentState.evidence,
          `Caregiver information has been superseded by a more recent update`,
          undefined
        );
      
      case 'unknown':
      default:
        return createUnknownAssessment(
          [],
          `Unable to determine caregiver status; requires verification`,
          undefined
        );
    }
  }
  
  /**
   * Find evidence that a caregiver is unavailable.
   */
  private findUnavailabilityEvidence(
    caregiver: CaregiverInfo,
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const evidence: FreshnessEvidence[] = [];
    const caregiverName = caregiver.name.toLowerCase();
    
    // Look for care events that indicate caregiver unavailability
     for (const event of events) {
       if ((event.event_type as string) === 'caregiver_unavailable' ||
           (event.event_type as string) === 'caregiver_left' ||
           (event.event_type as string) === 'caregiver_terminated') {
         const eventText = (event.content ?? '').toLowerCase();
        if (eventText.includes(caregiverName) || 
            eventText.includes('unavailable') || 
            eventText.includes('left') ||
            eventText.includes('terminated') ||
            eventText.includes('no longer')) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
      
      // Look for events that suggest the caregiver is no longer involved
      if (['responsibility_transferred', 'care_plan_updated'].includes(
        event.event_type as any
      )) {
        const eventText = (event.content ?? '').toLowerCase();
        if (eventText.includes(caregiverName) && 
            (eventText.includes('replaced') || 
             eventText.includes('transferred to') ||
             eventText.includes('no longer responsible'))) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
    }
    
    return evidence;
  }
  
  /**
   * Find evidence that a caregiver is available and active.
   */
  private findAvailabilityEvidence(
    caregiver: CaregiverInfo,
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const evidence: FreshnessEvidence[] = [];
    const caregiverName = caregiver.name.toLowerCase();
    
    // Look for care events that indicate caregiver availability and activity
     for (const event of events) {
       if ((event.event_type as string) === 'caregiver_available' ||
           (event.event_type as string) === 'caregiver_assigned' ||
           (event.event_type as string) === 'responsibility_assigned') {
         const eventText = (event.content ?? '').toLowerCase();
        if (eventText.includes(caregiverName) || 
            eventText.includes('assigned') || 
            eventText.includes('available') ||
            eventText.includes('responsible')) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
      
      // Look for general activity events
      if (['medication_given', 'meal_prepared', 'appointment_accompanied'].includes(
        event.event_type as any
      )) {
        // Check if this event involves our caregiver
        if (this.doesEventInvolveCaregiver(event, caregiver)) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
    }
    
    return evidence;
  }
  
  /**
   * Check if an event involves a specific caregiver.
   */
  private doesEventInvolveCaregiver(
    event: CareEventRecord,
    caregiver: CaregiverInfo
  ): boolean {
    // This is simplified - in reality, we would have structured data to check
    // For now, we'll return false as a placeholder
    return false;
  }
  
  /**
   * Find events that supersede caregiver information (e.g., a newer update).
   */
  private findSupersedingCaregiverEvents(
    caregiver: CaregiverInfo,
    events: CareEventRecord[]
  ): CareEventRecord[] {
    // For simplicity, we'll consider any caregiver change event with a more recent timestamp
    // as potentially superseding
    
    const caregiverTime = this.extractCaregiverTime(caregiver);
    if (!caregiverTime) return [];
    
    return events.filter(event => {
      if (!['caregiver_change', 'caregiver_assigned', 'caregiver_unavailable', 
           'caregiver_available', 'responsibility_assigned'].includes(
             event.event_type as any
         )) return false;
      
      const eventTime = new Date(event.created_at ?? event.occurred_at ?? '');
      return !isNaN(eventTime.getTime()) && eventTime > caregiverTime;
    });
  }
  
  /**
   * Extract a timestamp from caregiver information.
   */
  private extractCaregiverTime(caregiver: CaregiverInfo): Date | null {
    // Try to extract a timestamp from when the caregiver info was last updated
    // This is very simplified - a real implementation would use proper date parsing
    if (!caregiver.sourceText) return null;
    
    // Look for date patterns in the source text
    const dateMatch = caregiver.sourceText.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/);
    if (dateMatch) {
      return new Date(dateMatch[0]);
    }
    
    return null;
  }
  
  /**
   * Check if a caregiver has been verified recently.
   */
  private isVerifiedRecently(
    caregiver: CaregiverInfo,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): boolean {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Check decisions
    for (const decision of decisions) {
      const decisionDate = new Date(decision.decision_date);
      if (decisionDate >= thirtyDaysAgo) {
        // Check if this decision is related to our caregiver
        const decisionText = (decision.decision_description ?? decision.decision ?? '').toLowerCase();
        const caregiverDesc = caregiver.name.toLowerCase();
        if (decisionText.includes(caregiverDesc.substring(0, Math.min(20, caregiverDesc.length)))) {
          return true;
        }
      }
    }
    
    // Check events
     for (const event of events) {
       const eventDate = new Date((event.occurred_at ?? event.created_at) ?? '');
       if (eventDate >= thirtyDaysAgo) {
         // Check if this event is related to our caregiver
         const eventText = (event.content ?? '').toLowerCase();
        const caregiverDesc = caregiver.name.toLowerCase();
        if (eventText.includes(caregiverDesc.substring(0, Math.min(20, caregiverDesc.length)))) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Calculate time since last caregiver check.
   */
  private timeSinceLastCaregiverCheck(
    caregiver: CaregiverInfo,
    events: CareEventRecord[]
  ): number {
    // Find the most recent event related to this caregiver
    const caregiverEvents = events.filter(event => 
      this.isEventRelatedToCaregiver(event, caregiver)
    );
    
    if (caregiverEvents.length === 0) {
      // No events related to this caregiver - return a large number
      return 999;
    }
    
    // Find the most recent event
     const mostRecentEvent = caregiverEvents.reduce((latest, event) => {
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
   * Check if an event is related to a caregiver.
   */
  private isEventRelatedToCaregiver(
    event: CareEventRecord,
    caregiver: CaregiverInfo
  ): boolean {
    const caregiverName = caregiver.name.toLowerCase();
    const eventText = (event.content ?? '').toLowerCase();
    
    // Check if the event mentions the caregiver
    return eventText.includes(caregiverName.substring(0, Math.min(10, caregiverName.length)));
  }
  
  /**
   * Create freshness evidence from a caregiver info.
   */
  private createEvidenceFromCaregiverInfo(caregiver: CaregiverInfo): FreshnessEvidence {
    return createFreshnessEvidence(
      `${caregiver.name}-${caregiver.sourceText?.substring(0, 20) ?? 'no-source'}`,
      'caregiver_info',
      caregiver.sourceText ?? '',
      `Caregiver: ${caregiver.name} - ${caregiver.role ?? 'unspecified'}`,
      0.9
    );
  }
  
  /**
   * Create freshness evidence from a care event.
   */
  private createEvidenceFromCareEvent(event: CareEventRecord): FreshnessEvidence {
    return createFreshnessEvidence(
      event.id,
      `caregiver_event_${event.event_type}`,
      event.created_at,
      `Caregiver event: ${event.event_type} - ${event.content.substring(0, Math.min(50, event.content.length))}`,
      0.8
    );
  }
}

/**
 * Internal representation of the current caregiver state.
 */
interface CaregiverState {
  status: 'current' | 'verified' | 'needs_verification' | 'unavailable' | 'superseded' | 'unknown';
  reason: string;
  evidence: FreshnessEvidence[];
}