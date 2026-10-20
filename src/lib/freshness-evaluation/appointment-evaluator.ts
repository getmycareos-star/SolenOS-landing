import type { FreshnessEvaluator, FreshnessAssessment, FreshnessEvaluationContext, FreshnessEvidence } from '../freshness-evaluation/types';
import type { DecisionMemoryEntry } from '../decision-memory/index';
import type { AppointmentInfo } from '../document-intelligence/types';
import type { CareEventRecord } from '../care-events/types';
import { listDecisionMemory } from '../decision-memory';
import { createFreshnessEvidence, createCurrentAssessment, createStaleAssessment, createHistoricalAssessment, createSupersededAssessment, createExpiredAssessment, createUnknownAssessment, createConflictingAssessment, createVerifiedAssessment } from '../freshness-evaluation/types';

/**
 * Domain-specific freshness evaluator for appointment information.
 * Implements the appointment-specific freshness logic from the specification.
 */
export class AppointmentFreshnessEvaluator implements FreshnessEvaluator<AppointmentInfo> {
  /**
   * Evaluate the freshness of appointment information.
   * 
   * @param appointment The appointment information to evaluate
   * @param context Evaluation context containing care key and related evidence
   * @returns A freshness assessment for the appointment
   */
  async evaluateFreshness(
    appointment: AppointmentInfo,
    context: FreshnessEvaluationContext
  ): Promise<FreshnessAssessment> {
    const { careKey } = context;
    
    // Load decision memory for the care recipient (for context)
    const decisionEntries = listDecisionMemory(careKey);
    
    // Get appointment-related events from context
    const appointmentEvents = this.getAppointmentEvents(context);
    
    // Determine the current appointment state
    const currentState = this.determineCurrentAppointmentState(
      appointment, 
      decisionEntries, 
      appointmentEvents
    );
    
    // Assess freshness based on current state
    return this.assessAppointmentFreshness(
      appointment, 
      currentState, 
      decisionEntries, 
      appointmentEvents
    );
  }
  
  /**
   * Get a human-readable description of what this evaluator handles.
   */
  getDomainDescription(): string {
    return 'Appointment information (scheduled visits, referrals, follow-ups, deadlines, etc.)';
  }
  
  /**
   * Extract appointment-related events from context.
   * In a full implementation, this would come from the care record.
   */
  private getAppointmentEvents(context: FreshnessEvaluationContext): CareEventRecord[] {
    // For now, return empty array - in reality this would come from context or care record
    return context.relatedEvents?.filter((e: any) => 
      e.event_type === 'appointment'
    ) || [];
  }
  
  /**
   * Determine the current appointment state from the appointment itself and related events.
   * This represents what SolenOS believes is the current appointment status.
   */
  private determineCurrentAppointmentState(
    appointment: AppointmentInfo,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): AppointmentState {
    // For appointments, the current state is primarily determined by the appointment's timeframe
    // and whether it has occurred or been superseded
    
    // Check if there are any events that supersede this appointment
    const supersedingEvents = this.findSupersedingAppointmentEvents(
      appointment, 
      events
    );
    
    if (supersedingEvents.length > 0) {
      return {
        status: 'superseded',
        reason: 'Appointment has been superseded by a more recent appointment or event',
        evidence: supersedingEvents.map(e => this.createEvidenceFromCareEvent(e))
      };
    }
    
    // Check if the appointment timeframe has passed
    const timeframeStatus = this.checkAppointmentTimeframe(appointment);
    if (timeframeStatus === 'passed') {
      // Check if there's evidence it occurred
      const occurredEvidence = this.findAppointmentOccurrenceEvidence(
        appointment, 
        events
      );
      
      if (occurredEvidence.length > 0) {
        return {
          status: 'completed',
          reason: 'Appointment timeframe has passed and there is evidence it occurred',
          evidence: occurredEvidence
        };
      } else {
        return {
          status: 'missed',
          reason: 'Appointment timeframe has passed but there is no evidence it occurred',
          evidence: []
        };
      }
    }
    
    // If timeframe hasn't passed, it's upcoming/current
    if (timeframeStatus === 'upcoming') {
      return {
        status: 'upcoming',
        reason: 'Appointment is scheduled for the future',
        evidence: [this.createEvidenceFromAppointmentInfo(appointment)]
      };
    }
    
    // If we can't determine the timeframe, default to unknown
    return {
      status: 'unknown',
      reason: 'Unable to determine appointment timeframe',
      evidence: []
    };
  }
  
  /**
   * Assess the freshness of an appointment against the current state.
   */
  private assessAppointmentFreshness(
    appointment: AppointmentInfo,
    currentState: AppointmentState,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessAssessment {
    switch (currentState.status) {
      case 'upcoming':
        // Check if it's been verified recently (e.g., confirmed by patient/caregiver)
        const verifiedRecently = this.isVerifiedRecently(
          appointment, 
          decisions, 
          events
        );
        
        if (verifiedRecently) {
          return createVerifiedAssessment(
            [this.createEvidenceFromAppointmentInfo(appointment)],
            `Appointment is upcoming and has been recently verified`,
            undefined
          );
        }
        
        return createCurrentAssessment(
          [this.createEvidenceFromAppointmentInfo(appointment)],
          `Appointment is upcoming`,
          undefined
        );
      
      case 'completed':
        return createHistoricalAssessment(
          currentState.evidence,
          `Appointment has been completed`,
          undefined
        );
      
      case 'missed':
        return createStaleAssessment(
          ['PASSED_TEMPORAL_STATE'],
          currentState.evidence,
          `Appointment timeframe has passed but there is no evidence it occurred`,
          undefined
        );
      
      case 'superseded':
        return createSupersededAssessment(
          currentState.evidence,
          `Appointment has been superseded by a more recent appointment or event`,
          undefined
        );
      
      case 'unknown':
      default:
        return createUnknownAssessment(
          [],
          `Unable to determine appointment status; requires verification`,
          undefined
        );
    }
  }
  
  /**
   * Check if the appointment timeframe has passed.
   */
  private checkAppointmentTimeframe(appointment: AppointmentInfo): 'passed' | 'upcoming' | 'unknown' {
    // This is a simplified implementation - in reality, we would parse the timeframe string
    // and compare it to the current date
    
    // For now, we'll use a simple heuristic based on keywords in the timeframe
    const timeframe = appointment.timeframe?.toLowerCase() ?? '';
    const description = appointment.description.toLowerCase();
    const what = appointment.what.toLowerCase();
    const combinedText = `${timeframe} ${description} ${what}`;
    
    // Check for past time indicators
    const pastIndicators = [
      'yesterday', 'last week', 'last month', 'ago', 
      'previous', 'completed', 'finished', 'done'
    ];
    
    // Check for future time indicators
    const futureIndicators = [
      'tomorrow', 'next week', 'next month', 'upcoming',
      'scheduled', 'planned', 'will', 'going to'
    ];
    
    // Check for specific date patterns that would indicate past dates
    // This is very simplified - a real implementation would parse dates properly
    const hasPastDatePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(combinedText);
    const hasFutureDatePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(combinedText); // Simplified
    
    // If we have clear past indicators and no future indicators, it's likely passed
    const hasPastIndicator = pastIndicators.some(indicator => combinedText.includes(indicator));
    const hasFutureIndicator = futureIndicators.some(indicator => combinedText.includes(indicator));
    
    if (hasPastIndicator && !hasFutureIndicator) {
      return 'passed';
    }
    
    if (hasFutureIndicator && !hasPastIndicator) {
      return 'upcoming';
    }
    
    // If we have date patterns but no clear temporal indicators, we can't determine
    if (hasPastDatePattern || hasFutureDatePattern) {
      // In a real implementation, we would parse the date and compare to now
      // For now, we'll assume dates without clear indicators are in the past
      return 'passed';
    }
    
    // If we have no temporal information at all, we can't determine
    return 'unknown';
  }
  
  /**
   * Find events that supersede an appointment (e.g., a more recent appointment).
   */
  private findSupersedingAppointmentEvents(
    appointment: AppointmentInfo,
    events: CareEventRecord[]
  ): CareEventRecord[] {
    // For simplicity, we'll consider any appointment event with a more recent timestamp
    // as potentially superseding, but a real implementation would compare timeframes
    
    const appointmentTime = this.extractAppointmentTime(appointment);
    if (!appointmentTime) return [];
    
    return events.filter(event => {
      if (event.event_type !== 'appointment') return false;
      const eventTime = new Date(event.created_at ?? event.occurred_at ?? '');
      return !isNaN(eventTime.getTime()) && eventTime > appointmentTime;
    });
  }
  
  /**
   * Find evidence that an appointment occurred.
   */
  private findAppointmentOccurrenceEvidence(
    appointment: AppointmentInfo,
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const evidence: FreshnessEvidence[] = [];
    
    // Look for care events that indicate the appointment occurred
    for (const event of events) {
      // Look for events with types that suggest appointment completion
      if (['appointment_occurred', 'visit_completed', 'followup_completed'].includes(
        event.event_type as any
      )) {
        // Check if this event is related to our appointment
        // In a real implementation, we would match by ID or description
        evidence.push(this.createEvidenceFromCareEvent(event));
      }
      
      // Also look for general events that mention the appointment
      const eventText = (event.content ?? '').toLowerCase();
      const appointmentDesc = appointment.description.toLowerCase();
      if (eventText.includes(appointmentDesc.substring(0, Math.min(20, appointmentDesc.length)))) {
        evidence.push(this.createEvidenceFromCareEvent(event));
      }
    }
    
    return evidence;
  }
  
  /**
   * Extract a timestamp from appointment information.
   */
  private extractAppointmentTime(appointment: AppointmentInfo): Date | null {
    // Try to extract a timestamp from the timeframe
    // This is very simplified - a real implementation would use proper date parsing
    if (!appointment.timeframe) return null;
    
    // Look for date patterns in the timeframe
    const dateMatch = appointment.timeframe.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/);
    if (dateMatch) {
      return new Date(dateMatch[0]);
    }
    
    // Look for relative time patterns that we can't easily parse
    // For now, we'll return null for relative times like "in 2 weeks"
    return null;
  }
  
  /**
   * Check if an appointment has been verified recently.
   */
  private isVerifiedRecently(
    appointment: AppointmentInfo,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): boolean {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Check decisions
    for (const decision of decisions) {
      const decisionDate = new Date(decision.decision_date);
      if (decisionDate >= thirtyDaysAgo) {
        // Check if this decision is related to our appointment
        const decisionText = (decision.decision_description ?? decision.decision ?? '').toLowerCase();
        const appointmentDesc = appointment.description.toLowerCase();
        if (decisionText.includes(appointmentDesc.substring(0, Math.min(20, appointmentDesc.length)))) {
          return true;
        }
      }
    }
    
    // Check events
    for (const event of events) {
       const eventDate = new Date((event.occurred_at ?? event.created_at) ?? '');
      if (eventDate >= thirtyDaysAgo) {
        // Check if this event is related to our appointment
        const eventText = (event.content ?? '').toLowerCase();
        const appointmentDesc = appointment.description.toLowerCase();
        if (eventText.includes(appointmentDesc.substring(0, Math.min(20, appointmentDesc.length)))) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Create freshness evidence from an appointment info.
   */
  private createEvidenceFromAppointmentInfo(appointment: AppointmentInfo): FreshnessEvidence {
    return createFreshnessEvidence(
      `${appointment.description}-${appointment.timeframe ?? 'no-timeframe'}`,
      'appointment_info',
      appointment.sourceText,
      `Appointment: ${appointment.kind} - ${appointment.description} ${appointment.timeframe ?? ''}`,
      0.9
    );
  }
  
  /**
   * Create freshness evidence from a care event.
   */
  private createEvidenceFromCareEvent(event: CareEventRecord): FreshnessEvidence {
    return createFreshnessEvidence(
      event.id,
      `appointment_event_${event.event_type}`,
      event.created_at,
      `Appointment event: ${event.event_type} - ${event.content.substring(0, Math.min(50, event.content.length))}`,
      0.8
    );
  }
}

/**
 * Internal representation of the current appointment state.
 */
interface AppointmentState {
  status: 'upcoming' | 'completed' | 'missed' | 'superseded' | 'unknown';
  reason: string;
  evidence: FreshnessEvidence[];
}