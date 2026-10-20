import type { FreshnessEvaluator, FreshnessAssessment, FreshnessEvaluationContext, FreshnessEvidence } from '../freshness-evaluation/types';
import type { DecisionMemoryEntry } from '../decision-memory/index';
import type { CarePerson as ProfessionalInfo } from '../document-intelligence/types';
import type { CareEventRecord } from '../care-events/types';
import { listDecisionMemory } from '../decision-memory';
import { createFreshnessEvidence, createCurrentAssessment, createStaleAssessment, createHistoricalAssessment, createSupersededAssessment, createExpiredAssessment, createUnknownAssessment, createConflictingAssessment, createVerifiedAssessment } from '../freshness-evaluation/types';

/**
 * Domain-specific freshness evaluator for professional information.
 * Implements the professional-specific freshness logic from the specification.
 */
export class ProfessionalFreshnessEvaluator implements FreshnessEvaluator<ProfessionalInfo> {
  /**
   * Evaluate the freshness of professional information.
   * 
   * @param professional The professional information to evaluate
   * @param context Evaluation context containing care key and related evidence
   * @returns A freshness assessment for the professional
   */
  async evaluateFreshness(
    professional: ProfessionalInfo,
    context: FreshnessEvaluationContext
  ): Promise<FreshnessAssessment> {
    const { careKey } = context;
    
    // Load decision memory for the care recipient (for context)
    const decisionEntries = listDecisionMemory(careKey);
    
    // Get professional-related events from context
    const professionalEvents = this.getProfessionalEvents(context);
    
    // Determine the current professional state
    const currentState = this.determineCurrentProfessionalState(
      professional, 
      decisionEntries, 
      professionalEvents
    );
    
    // Assess freshness based on current state
    return this.assessProfessionalFreshness(
      professional, 
      currentState, 
      decisionEntries, 
      professionalEvents
    );
  }
  
  /**
   * Get a human-readable description of what this evaluator handles.
   */
  getDomainDescription(): string {
    return 'Professional information (doctor details, specialist contacts, facility information, etc.)';
  }
  
  /**
   * Extract professional-related events from context.
   * In a full implementation, this would come from the care record.
   */
  private getProfessionalEvents(context: FreshnessEvaluationContext): CareEventRecord[] {
    // For now, return empty array - in reality this would come from context or care record
    return context.relatedEvents?.filter((e: any) => 
      e.event_type === 'professional_change' ||
      e.event_type === 'provider_assigned' ||
      e.event_type === 'provider_unavailable' ||
      e.event_type === 'facility_change'
    ) || [];
  }
  
  /**
   * Determine the current professional state from the professional info and related events.
   * This represents what SolenOS believes is the current professional status.
   */
  private determineCurrentProfessionalState(
    professional: ProfessionalInfo,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): ProfessionalState {
    // Check if there are any events that supersede this professional info
    const supersedingEvents = this.findSupersedingProfessionalEvents(
      professional, 
      events
    );
    
    if (supersedingEvents.length > 0) {
      return {
        status: 'superseded',
        reason: 'Professional information has been superseded by a more recent update',
        evidence: supersedingEvents.map(e => this.createEvidenceFromCareEvent(e))
      };
    }
    
    // Check if the professional has become unavailable
    const unavailabilityEvidence = this.findUnavailabilityEvidence(
      professional, 
      events
    );
    
    if (unavailabilityEvidence.length > 0) {
      return {
        status: 'unavailable',
        reason: 'Professional is currently unavailable per recent updates',
        evidence: unavailabilityEvidence
      };
    }
    
    // Check if there's evidence the professional is available and active
    const availabilityEvidence = this.findAvailabilityEvidence(
      professional, 
      events
    );
    
    if (availabilityEvidence.length > 0) {
      // Check if it's been verified recently
      const verifiedRecently = this.isVerifiedRecently(
        professional, 
        decisions, 
        events
      );
      
      if (verifiedRecently) {
        return {
          status: 'verified',
          reason: 'Professional information is current and has been recently verified',
          evidence: availabilityEvidence
        };
      }
      
      return {
        status: 'current',
        reason: 'Professional information is current based on recent evidence',
        evidence: availabilityEvidence
      };
    }
    
    // If we have no evidence either way, check if it's time for a professional check
    const timeSinceLastCheck = this.timeSinceLastProfessionalCheck(
      professional, 
      events
    );
    
    if (timeSinceLastCheck > 90) { // More than 90 days since last check (professionals change less frequently)
      return {
        status: 'needs_verification',
        reason: `No recent verification of professional status (>${timeSinceLastCheck} days)`,
        evidence: []
      };
    }
    
    // Default to current if we have no contradictory evidence
    return {
      status: 'current',
      reason: 'No evidence suggesting the professional information has changed',
      evidence: [this.createEvidenceFromProfessionalInfo(professional)]
    };
  }
  
  /**
   * Assess the freshness of professional information against the current state.
   */
  private assessProfessionalFreshness(
    professional: ProfessionalInfo,
    currentState: ProfessionalState,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessAssessment {
    switch (currentState.status) {
      case 'verified':
        return createVerifiedAssessment(
          currentState.evidence,
          `Professional information is current and has been recently verified`,
          undefined
        );
      
      case 'current':
        return createCurrentAssessment(
          currentState.evidence,
          `Professional information is current based on recent evidence`,
          undefined
        );
      
      case 'needs_verification':
        return createStaleAssessment(
          ['LACK_OF_RECENT_CONFIRMATION'],
          currentState.evidence,
          `No recent verification of professional status; requires confirmation`,
          undefined
        );
      
      case 'unavailable':
        return createStaleAssessment(
          ['SOURCE_LIMITED_VALIDITY'],
          currentState.evidence,
          `Professional is currently unavailable per recent updates`,
          undefined
        );
      
      case 'superseded':
        return createSupersededAssessment(
          currentState.evidence,
          `Professional information has been superseded by a more recent update`,
          undefined
        );
      
      case 'unknown':
      default:
        return createUnknownAssessment(
          [],
          `Unable to determine professional status; requires verification`,
          undefined
        );
    }
  }
  
  /**
   * Find evidence that a professional is unavailable.
   */
  private findUnavailabilityEvidence(
    professional: ProfessionalInfo,
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const evidence: FreshnessEvidence[] = [];
    const professionalName = professional.name.toLowerCase();
    
    // Look for care events that indicate professional unavailability
     for (const event of events) {
       if ((event.event_type as string) === 'provider_unavailable' ||
           (event.event_type as string) === 'facility_closed' ||
           (event.event_type as string) === 'provider_left_practice') {
         const eventText = (event.content ?? '').toLowerCase();
        if (eventText.includes(professionalName) || 
            eventText.includes('unavailable') || 
            eventText.includes('closed') ||
            eventText.includes('left practice') ||
            eventText.includes('no longer')) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
      
      // Look for events that suggest the professional is no longer involved
      if (['referral_to_other_provider', 'care_transferred'].includes(
        event.event_type as any
      )) {
        const eventText = (event.content ?? '').toLowerCase();
        if (eventText.includes(professionalName) && 
            (eventText.includes('referred to') || 
             eventText.includes('transferred to') ||
             eventText.includes('seeing someone else'))) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
    }
    
    return evidence;
  }
  
  /**
   * Find evidence that a professional is available and active.
   */
  private findAvailabilityEvidence(
    professional: ProfessionalInfo,
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const evidence: FreshnessEvidence[] = [];
    const professionalName = professional.name.toLowerCase();
    
    // Look for care events that indicate professional availability and activity
     for (const event of events) {
       if ((event.event_type as string) === 'provider_available' ||
           (event.event_type as string) === 'provider_assigned' ||
           (event.event_type as string) === 'new_patient_accepted') {
         const eventText = (event.content ?? '').toLowerCase();
        if (eventText.includes(professionalName) || 
            eventText.includes('assigned') || 
            eventText.includes('available') ||
            eventText.includes('accepting')) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
      
      // Look for general activity events
      if (['appointment_completed', 'consultation_occurred', 'procedure_performed'].includes(
        event.event_type as any
      )) {
        // Check if this event involves our professional
        if (this.doesEventInvolveProfessional(event, professional)) {
          evidence.push(this.createEvidenceFromCareEvent(event));
        }
      }
    }
    
    return evidence;
  }
  
  /**
   * Check if an event involves a specific professional.
   */
  private doesEventInvolveProfessional(
    event: CareEventRecord,
    professional: ProfessionalInfo
  ): boolean {
    // This is simplified - in reality, we would have structured data to check
    // For now, we'll return false as a placeholder
    return false;
  }
  
  /**
   * Find events that supersede professional information (e.g., a newer update).
   */
  private findSupersedingProfessionalEvents(
    professional: ProfessionalInfo,
    events: CareEventRecord[]
  ): CareEventRecord[] {
    // For simplicity, we'll consider any professional change event with a more recent timestamp
    // as potentially superseding
    
    const professionalTime = this.extractProfessionalTime(professional);
    if (!professionalTime) return [];
    
    return events.filter(event => {
      if (!['professional_change', 'provider_assigned', 'provider_unavailable', 
           'provider_available', 'facility_change'].includes(
             event.event_type as any
         )) return false;
      
      const eventTime = new Date(event.created_at ?? event.occurred_at ?? '');
      return !isNaN(eventTime.getTime()) && eventTime > professionalTime;
    });
  }
  
  /**
   * Extract a timestamp from professional information.
   */
  private extractProfessionalTime(professional: ProfessionalInfo): Date | null {
    // Try to extract a timestamp from when the professional info was last updated
    // This is very simplified - a real implementation would use proper date parsing
    if (!professional.sourceText) return null;
    
    // Look for date patterns in the source text
    const dateMatch = professional.sourceText.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/);
    if (dateMatch) {
      return new Date(dateMatch[0]);
    }
    
    return null;
  }
  
  /**
   * Check if a professional has been verified recently.
   */
  private isVerifiedRecently(
    professional: ProfessionalInfo,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): boolean {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Check decisions
    for (const decision of decisions) {
      const decisionDate = new Date(decision.decision_date);
      if (decisionDate >= thirtyDaysAgo) {
        // Check if this decision is related to our professional
        const decisionText = (decision.decision_description ?? decision.decision ?? '').toLowerCase();
        const professionalDesc = professional.name.toLowerCase();
        if (decisionText.includes(professionalDesc.substring(0, Math.min(20, professionalDesc.length)))) {
          return true;
        }
      }
    }
    
    // Check events
     for (const event of events) {
       const eventDate = new Date((event.occurred_at ?? event.created_at) ?? '');
       if (eventDate >= thirtyDaysAgo) {
         // Check if this event is related to our professional
         const eventText = (event.content ?? '').toLowerCase();
        const professionalDesc = professional.name.toLowerCase();
        if (eventText.includes(professionalDesc.substring(0, Math.min(20, professionalDesc.length)))) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Calculate time since last professional check.
   */
  private timeSinceLastProfessionalCheck(
    professional: ProfessionalInfo,
    events: CareEventRecord[]
  ): number {
    // Find the most recent event related to this professional
    const professionalEvents = events.filter(event => 
      this.isEventRelatedToProfessional(event, professional)
    );
    
    if (professionalEvents.length === 0) {
      // No events related to this professional - return a large number
      return 999;
    }
    
    // Find the most recent event
     const mostRecentEvent = professionalEvents.reduce((latest, event) => {
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
   * Check if an event is related to a professional.
   */
  private isEventRelatedToProfessional(
    event: CareEventRecord,
    professional: ProfessionalInfo
  ): boolean {
    const professionalName = professional.name.toLowerCase();
    const eventText = (event.content ?? '').toLowerCase();
    
    // Check if the event mentions the professional
    return eventText.includes(professionalName.substring(0, Math.min(10, professionalName.length)));
  }
  
  /**
   * Create freshness evidence from a professional info.
   */
  private createEvidenceFromProfessionalInfo(professional: ProfessionalInfo): FreshnessEvidence {
    return createFreshnessEvidence(
      `${professional.name}-${professional.sourceText?.substring(0, 20) ?? 'no-source'}`,
      'professional_info',
      professional.sourceText ?? '',
       `Professional: ${professional.name} - ${professional.role ?? 'unspecified'}`,
      0.9
    );
  }
  
  /**
   * Create freshness evidence from a care event.
   */
  private createEvidenceFromCareEvent(event: CareEventRecord): FreshnessEvidence {
    return createFreshnessEvidence(
      event.id,
      `professional_event_${event.event_type}`,
      event.created_at,
      `Professional event: ${event.event_type} - ${event.content.substring(0, Math.min(50, event.content.length))}`,
      0.8
    );
  }
}

/**
 * Internal representation of the current professional state.
 */
interface ProfessionalState {
  status: 'current' | 'verified' | 'needs_verification' | 'unavailable' | 'superseded' | 'unknown';
  reason: string;
  evidence: FreshnessEvidence[];
}