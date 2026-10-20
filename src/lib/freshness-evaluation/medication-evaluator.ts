import type { FreshnessEvaluator, FreshnessAssessment, FreshnessEvaluationContext, FreshnessEvidence } from '../freshness-evaluation/types';
import type { DecisionMemoryEntry } from '../decision-memory/index';
import type { CareEventRecord } from '../care-events/types';
import type { MedicationInfo } from '../document-intelligence/types';
import { listDecisionMemory } from '../decision-memory';
import { createFreshnessEvidence, createCurrentAssessment, createStaleAssessment, createHistoricalAssessment, createSupersededAssessment, createExpiredAssessment, createUnknownAssessment, createConflictingAssessment, createVerifiedAssessment } from '../freshness-evaluation/types';

/**
 * Domain-specific freshness evaluator for medication information.
 * Implements the medication-specific freshness logic from the specification.
 */
export class MedicationFreshnessEvaluator implements FreshnessEvaluator<MedicationInfo> {
  /**
   * Evaluate the freshness of medication information.
   * 
   * @param medication The medication information to evaluate
   * @param context Evaluation context containing care key and related evidence
   * @returns A freshness assessment for the medication
   */
  async evaluateFreshness(
    medication: MedicationInfo,
    context: FreshnessEvaluationContext
  ): Promise<FreshnessAssessment> {
    const { careKey } = context;
    
    // Load decision memory for the care recipient
    const decisionEntries = listDecisionMemory(careKey);
    
    // Get medication-related decisions and events from context
    const medicationDecisions = this.getMedicationDecisions(decisionEntries);
    const medicationEvents = this.getMedicationEvents(context);
    
    // Determine the current medication state
    const currentState = this.determineCurrentMedicationState(
      medicationDecisions, 
      medicationEvents
    );
    
    // Assess freshness based on current state
    return this.assessMedicationFreshness(
      medication, 
      currentState, 
      medicationDecisions, 
      medicationEvents
    );
  }
  
  /**
   * Get a human-readable description of what this evaluator handles.
   */
  getDomainDescription(): string {
    return 'Medication information (name, dose, frequency, instructions, etc.)';
  }
  
   /**
    * Get medication-related decisions from the decision memory.
    */
   private getMedicationDecisions(decisions: DecisionMemoryEntry[]): DecisionMemoryEntry[] {
     return decisions.filter(d => 
       d.decision_type === 'medication_started' ||
       (d.decision_type as string) === 'medication_stopped' ||
       d.decision_type === 'medication_changed'
     );
   }
   
  /**
   * Extract medication-related events from context.
   * In a full implementation, this would come from the care record.
   */
   private getMedicationEvents(context: FreshnessEvaluationContext): CareEventRecord[] {
     // For now, return empty array - in reality this would come from context or care record
     return context.relatedEvents?.filter((e: any) => 
       e.event_type === 'medication_change' ||
       e.event_type === 'medication_started' ||
       (e.event_type as string) === 'medication_stopped'
     ) || [];
   }
   
  /**
   * Determine the current medication state from decisions and events.
   * This represents what SolenOS believes is the current medication regimen.
   */
  private determineCurrentMedicationState(
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): MedicationState {
     // Filter medication-related decisions
     const medicationDecisions = decisions.filter(d => 
       d.decision_type === 'medication_started' ||
       (d.decision_type as string) === 'medication_stopped' ||
       d.decision_type === 'medication_changed'
     );
     
     // Sort by decision date (most recent first)
     const sortedDecisions = [...medicationDecisions].sort((a, b) => 
       new Date(b.decision_date).getTime() - new Date(a.decision_date).getTime()
     );
    
    // Build a map of medication name to the most recent decision that is not superseded
    const currentMedications: Map<string, DecisionMedicationInfo> = new Map();
    
    for (const decision of sortedDecisions) {
      // Skip decisions that are superseded by a later decision
      if (decision.superseded_by) continue;
      
      // Extract medication information from the decision
      const medInfo = this.extractMedicationInfoFromDecision(decision);
      if (!medInfo) continue;
      
      // If we already have a current medication for this name, skip (since we process in order)
      if (currentMedications.has(medInfo.name.toLowerCase())) continue;
      
      currentMedications.set(medInfo.name.toLowerCase(), medInfo);
    }
    
    // Also consider medication change events from the care record
    // Sort events by date (most recent first)
       const sortedEvents = [...events].sort((a, b) => 
       new Date(b.occurred_at ?? b.created_at).getTime() - new Date(a.occurred_at ?? a.created_at).getTime()
     );
    
    for (const event of sortedEvents) {
      // Extract medication information from the event
      const medInfo = this.extractMedicationInfoFromEvent(event);
      if (!medInfo) continue;
      
      const key = medInfo.name.toLowerCase();
      // If we don't have a current medication from decisions, or if the event is more recent than the decision
      const currentDecision = currentMedications.get(key);
       if (!currentDecision || 
           new Date(event.occurred_at ?? event.created_at).getTime() > 
           new Date(currentDecision.decision_date).getTime()) {
        currentMedications.set(key, {
          name: medInfo.name,
          dose: medInfo.dose,
          frequency: medInfo.frequency,
          status: medInfo.status,
           decision_date: event.occurred_at ?? event.created_at,
          source: 'event'
        });
      }
    }
    
    return {
      medications: Array.from(currentMedications.values())
    };
  }
  
  /**
   * Extract medication information from a decision entry.
   */
  private extractMedicationInfoFromDecision(decision: DecisionMemoryEntry): DecisionMedicationInfo | null {
    // Try to parse the decision text for medication information
    const text = decision.decision_description ?? decision.decision;
    
    // Look for medication name patterns
    const medicationNameMatch = text.match(/\b([A-Z][a-zA-Z]{1,40}(?:\s+[a-z][a-zA-Z]{1,40})?)\b/i);
    if (!medicationNameMatch) return null;
    
    const name = medicationNameMatch[1];
    
    // Look for dose patterns
    const doseMatch = text.match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|units?|g)\b/i);
    const dose = doseMatch ? doseMatch[0] : undefined;
    
    // Look for frequency patterns
    const frequencyMatch = text.match(/\b(?:once|twice|three times|daily|every day|every\s+\d+\s*hours?|Q\s?\d+[hH]?|at bedtime|at night|with meals|on an empty stomach|before meals|after meals|as needed|PRN|twice a day|once a day|BID|TID)\b/i);
    const frequency = frequencyMatch ? frequencyMatch[0] : undefined;
    
     // Determine status based on decision type
     let status: 'new' | 'continuing' | 'discontinued' | 'dosage_changed' | 'unknown' = 'unknown';
     if (decision.decision_type === 'medication_started') {
       status = 'new';
     } else if ((decision.decision_type as string) === 'medication_stopped') {
       status = 'discontinued';
     } else if (decision.decision_type === 'medication_changed') {
       status = 'dosage_changed';
     }
    
    return {
      name,
      dose,
      frequency,
      status,
      decision_date: decision.decision_date,
      source: 'decision'
    };
  }
  
  /**
   * Extract medication information from a care event.
   * This is a placeholder - in reality, we would parse the structured care event.
   */
  private extractMedicationInfoFromEvent(event: CareEventRecord): DecisionMedicationInfo | null {
    // The care event's structured field may contain medication information
    // For now, we'll return null as a placeholder
    // In a full implementation, we would parse event.structured for medication details
    return null;
  }
  
  /**
   * Assess the freshness of a medication against the current state.
   */
  private assessMedicationFreshness(
    medication: MedicationInfo,
    currentState: MedicationState,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessAssessment {
    // Check if the medication is in the current state
    const currentMed = currentState.medications.find(m => 
      m.name.toLowerCase() === medication.name.toLowerCase()
    );
    
    if (!currentMed) {
      // Medication not found in current state
      // Check if there is evidence that it was discontinued
      const discontinuedEvidence = this.findDiscontinuationEvidence(
        medication.name, 
        decisions, 
        events
      );
      
      if (discontinuedEvidence.length > 0) {
        return createSupersededAssessment(
          discontinuedEvidence,
          `Medication has been discontinued per recent decision or event`,
          undefined
        );
      }
      
      // Check if there is conflicting evidence
      const conflictingEvidence = this.findConflictingEvidence(
        medication.name, 
        decisions, 
        events
      );
      
      if (conflictingEvidence.length > 0) {
        return createConflictingAssessment(
          conflictingEvidence,
          `Conflicting evidence exists about this medication's current status`,
          undefined
        );
      }
      
      // Check if medication might be expired (has explicit validity period)
      const expiredEvidence = this.findExpirationEvidence(
        medication.name, 
        decisions, 
        events
      );
      
      if (expiredEvidence.length > 0) {
        return createExpiredAssessment(
          expiredEvidence,
          `Medication has expired based on explicit validity period`,
          undefined
        );
      }
      
      // If no evidence of discontinuation, conflict, or expiration, it might be historical
      return createHistoricalAssessment(
        [],
        `Medication not found in current state; may be historical`,
        undefined
      );
    }
    
    // Medication found in current state - check if it matches
    const matches = this.medicationMatchesCurrentState(medication, currentMed);
    if (matches) {
      // Check if it's been verified recently
      const verifiedRecently = this.isVerifiedRecently(
        medication.name, 
        decisions, 
        events
      );
      
      if (verifiedRecently) {
        return createVerifiedAssessment(
          [this.createEvidenceFromMedicationDecision(currentMed)],
          `Medication matches current state and has been recently verified`,
          undefined
        );
      }
      
      return createCurrentAssessment(
        [this.createEvidenceFromMedicationDecision(currentMed)],
        `Medication matches current state`,
        undefined
      );
    }
    
    // Check if the medication has been superseded by a more recent decision or event
    const supersedingEvidence = this.findSupersedingEvidence(
      medication.name, 
      decisions, 
      events
    );
    
    if (supersedingEvidence.length > 0) {
      return createSupersededAssessment(
        supersedingEvidence,
        `Medication has been superseded by newer information`,
        undefined
      );
    }
    
    // Check for conflicting evidence
    const conflictingEvidence = this.findConflictingEvidence(
      medication.name, 
      decisions, 
      events
    );
    
    if (conflictingEvidence.length > 0) {
      return createConflictingAssessment(
        conflictingEvidence,
        `Conflicting evidence exists about this medication's current status`,
        undefined
      );
    }
    
    // Check for explicit validity period expiration
    const expirationEvidence = this.findExpirationEvidence(
      medication.name, 
      decisions, 
      events
    );
    
    if (expirationEvidence.length > 0) {
      return createExpiredAssessment(
        expirationEvidence,
        `Medication has expired based on explicit validity period`,
        undefined
      );
    }
    
    // Check for context transition that might affect medication
    const contextChangeEvidence = this.findContextChangeEvidence(
      medication.name, 
      decisions, 
      events
    );
    
    if (contextChangeEvidence.length > 0) {
      return createStaleAssessment(
        ['CONTEXT_TRANSITION'],
        contextChangeEvidence,
        `Medication may be stale due to context transition (caregiver, professional, or care setting change)`,
        undefined
      );
    }
    
    // Check for lack of recent confirmation
    const confirmationEvidence = this.findRecentConfirmationEvidence(
      medication.name, 
      decisions, 
      events
    );
    
    if (!confirmationEvidence || confirmationEvidence.length === 0) {
      // Look for any evidence that might suggest needing confirmation
      const anyEvidence = this.findAnyMedicationEvidence(
        medication.name, 
        decisions, 
        events
      );
      
      if (anyEvidence.length > 0) {
        return createStaleAssessment(
          ['LACK_OF_RECENT_CONFIRMATION'],
          anyEvidence,
          `No recent confirmation of medication regimen; requires verification`,
          undefined
        );
      }
    }
    
    // Default to stale if we can't determine
     return createStaleAssessment(
       ['LACK_OF_RECENT_CONFIRMATION'],
       [],
       `Unable to determine currentness; requires verification`,
       undefined
     );
  }
  
  /**
   * Check if medication matches the current state.
   */
  private medicationMatchesCurrentState(
    medication: MedicationInfo,
    currentMed: DecisionMedicationInfo
  ): boolean {
    // Compare name (case-insensitive)
    if (medication.name.toLowerCase() !== currentMed.name.toLowerCase()) {
      return false;
    }
    
    // Compare dose if both present
    if (medication.dose && currentMed.dose) {
      if (medication.dose !== currentMed.dose) {
        return false;
      }
    } else if (medication.dose || currentMed.dose) {
      // One has dose and the other doesn't
      return false;
    }
    
    // Compare frequency if both present
    if (medication.frequency && currentMed.frequency) {
      if (medication.frequency !== currentMed.frequency) {
        return false;
      }
    } else if (medication.frequency || currentMed.frequency) {
      return false;
    }
    
    // For now, consider it a match if name, dose, and frequency match
    // In a more sophisticated implementation, we would also check instructions, etc.
    return true;
  }
  
  /**
   * Find evidence that a medication has been discontinued.
   */
   private findDiscontinuationEvidence(
     medicationName: string,
     decisions: DecisionMemoryEntry[],
     events: CareEventRecord[]
   ): FreshnessEvidence[] {
     const lowerName = medicationName.toLowerCase();
     const evidence: FreshnessEvidence[] = [];
     
     // Look for discontinuation decisions
     for (const decision of decisions) {
       if ((decision.decision_type as string) === 'medication_stopped') {
         const medInfo = this.extractMedicationInfoFromDecision(decision);
         if (medInfo && medInfo.name.toLowerCase() === lowerName) {
           evidence.push(createFreshnessEvidence(
             decision.id,
             'medication_stopped_decision',
            decision.decision_date,
            `Medication stopped: ${decision.decision_description}`,
            0.9
          ));
        }
      }
    }
    
     // Look for discontinuation events
     for (const event of events) {
       if ((event.event_type as string) === 'medication_stopped') {
         const medInfo = this.extractMedicationInfoFromEvent(event);
         if (medInfo && medInfo.name.toLowerCase() === lowerName) {
           evidence.push(createFreshnessEvidence(
             event.id,
              'medication_stopped_event',
             event.occurred_at ?? event.created_at,
             `Medication stopped: ${event.content || 'No details'}`,
             0.8
           ));
         }
       }
     }
    
    return evidence;
  }
  
  /**
   * Find conflicting evidence about a medication.
   */
  private findConflictingEvidence(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const lowerName = medicationName.toLowerCase();
    const evidence: FreshnessEvidence[] = [];
    
    // Look for both started and stopped decisions for the same medication without clear supersession
    const startedDecisions = decisions.filter(d => 
      d.decision_type === 'medication_started' &&
      this.extractMedicationInfoFromDecision(d)?.name.toLowerCase() === lowerName
     );
     
     const stoppedDecisions = decisions.filter(d => 
       (d.decision_type as string) === 'medication_stopped' &&
       this.extractMedicationInfoFromDecision(d)?.name.toLowerCase() === lowerName
     );
     
     if (startedDecisions.length > 0 && stoppedDecisions.length > 0) {
       // Check if there is a clear supersession relationship
       const hasClearSupersession = startedDecisions.some(sd => 
        stoppedDecisions.some(stop => 
          stop.superseded_by === sd.id || sd.superseded_by === stop.id
        )
      );
      
      if (!hasClearSupersession) {
        evidence.push(
          ...startedDecisions.map(d => createFreshnessEvidence(
            d.id,
            'medication_started_decision',
            d.decision_date,
            `Medication started: ${d.decision_description}`,
            0.8
          )),
          ...stoppedDecisions.map(d => createFreshnessEvidence(
            d.id,
            'medication_stopped_decision',
            d.decision_date,
            `Medication stopped: ${d.decision_description}`,
            0.8
          ))
        );
      }
    }
    
    // Look for both dosage changed and continuing evidence without clear resolution
    const changedDecisions = decisions.filter(d => 
      d.decision_type === 'medication_changed' &&
      this.extractMedicationInfoFromDecision(d)?.name.toLowerCase() === lowerName
    );
    
    const continuingDecisions = decisions.filter(d => 
      d.decision_type === 'medication_started' && // Assuming started implies continuing unless stopped
      this.extractMedicationInfoFromDecision(d)?.name.toLowerCase() === lowerName
    );
    
    // This is simplified - real implementation would be more sophisticated
    
    return evidence;
  }
  
  /**
   * Find evidence that supersedes a medication.
   */
  private findSupersedingEvidence(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const lowerName = medicationName.toLowerCase();
    const evidence: FreshnessEvidence[] = [];
    
    // Look for decisions that supersede previous decisions for this medication
    for (const decision of decisions) {
      if (decision.superseded_by) {
        // This decision is superseded by another - not what we want
        continue;
      }
      
      const medInfo = this.extractMedicationInfoFromDecision(decision);
      if (medInfo && medInfo.name.toLowerCase() === lowerName) {
        // Check if this decision supersedes any previous decision
        const supersededDecisions = decisions.filter(d => 
          d.superseded_by === decision.id &&
          this.extractMedicationInfoFromDecision(d)?.name.toLowerCase() === lowerName
        );
        
        if (supersededDecisions.length > 0) {
          evidence.push(createFreshnessEvidence(
            decision.id,
            'medication_superseding_decision',
            decision.decision_date,
            `Medication decision that supersedes previous: ${decision.decision_description}`,
            0.9
          ));
          
          // Also add the superseded decisions for context
          evidence.push(
            ...supersededDecisions.map(d => createFreshnessEvidence(
              d.id,
              'medication_superseded_decision',
              d.decision_date,
              `Superseded medication decision: ${d.decision_description}`,
              0.8
            ))
          );
          return evidence;
        }
      }
    }
    
    // TODO: Check events for superseding evidence
    
    return evidence;
  }
  
  /**
   * Find evidence of explicit expiration (valid_until date passed).
   */
  private findExpirationEvidence(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    // This would look for explicit validity periods in medication information
    // For now, return empty as placeholder
    return [];
  }
  
  /**
   * Find evidence of context transition that might affect medication.
   */
  private findContextChangeEvidence(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    // Look for changes in caregiver, professional, or care setting
    const evidence: FreshnessEvidence[] = [];
    
    // Look for responsibility changes
    const responsibilityChanges = decisions.filter(d => 
      d.decision_type === 'responsibility_assignment'
    );
    
    for (const decision of responsibilityChanges) {
      evidence.push(createFreshnessEvidence(
        decision.id,
        'responsibility_change_decision',
        decision.decision_date,
        `Caregiver responsibility changed: ${decision.decision_description}`,
        0.7
      ));
    }
    
    // Look for professional changes
    const professionalChanges = decisions.filter(d => 
      d.decision_type === 'care_setting_decision' ||
      d.decision_type === 'treatment_plan_decision'
    );
    
    for (const decision of professionalChanges) {
      evidence.push(createFreshnessEvidence(
        decision.id,
        'professional_change_decision',
        decision.decision_date,
        `Professional or care setting changed: ${decision.decision_description}`,
        0.7
      ));
    }
    
    return evidence;
  }
  
  /**
   * Find recent confirmation evidence for a medication.
   */
  private findRecentConfirmationEvidence(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessEvidence[] | null {
    const lowerName = medicationName.toLowerCase();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Look for recent medication verification or confirmation
    const recentEvidence: FreshnessEvidence[] = [];
    
    // Check decisions
    for (const decision of decisions) {
      const decisionDate = new Date(decision.decision_date);
      if (decisionDate >= thirtyDaysAgo) {
        const medInfo = this.extractMedicationInfoFromDecision(decision);
        if (medInfo && medInfo.name.toLowerCase() === lowerName) {
          recentEvidence.push(createFreshnessEvidence(
            decision.id,
            'medication_confirmation_decision',
            decision.decision_date,
            `Recent medication decision: ${decision.decision_description}`,
            0.8
          ));
        }
      }
    }
    
     // Check events
     for (const event of events) {
       const eventDate = new Date((event.occurred_at ?? event.created_at));
       if (eventDate >= thirtyDaysAgo) {
         const medInfo = this.extractMedicationInfoFromEvent(event);
         if (medInfo && medInfo.name.toLowerCase() === lowerName) {
           recentEvidence.push(createFreshnessEvidence(
             event.id,
             'medication_confirmation_event',
             event.occurred_at ?? event.created_at,
             `Recent medication event: ${event.content || 'No details'}`,
             0.7
          ));
        }
      }
    }
    
    return recentEvidence.length > 0 ? recentEvidence : null;
  }
  
  /**
   * Find any evidence related to a medication.
   */
  private findAnyMedicationEvidence(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): FreshnessEvidence[] {
    const lowerName = medicationName.toLowerCase();
    const evidence: FreshnessEvidence[] = [];
    
    // Check all decisions
    for (const decision of decisions) {
      const medInfo = this.extractMedicationInfoFromDecision(decision);
      if (medInfo && medInfo.name.toLowerCase() === lowerName) {
        evidence.push(createFreshnessEvidence(
          decision.id,
          'medication_related_decision',
          decision.decision_date,
          `Medication-related decision: ${decision.decision_description}`,
          0.6
        ));
      }
    }
    
    // Check all events
    for (const event of events) {
      const medInfo = this.extractMedicationInfoFromEvent(event);
      if (medInfo && medInfo.name.toLowerCase() === lowerName) {
        evidence.push(createFreshnessEvidence(
          event.id,
          'medication_related_event',
           event.occurred_at ?? event.created_at,
           `Medication-related event: ${event.content || 'No details'}`,
           0.5
         ));
      }
    }
    
    return evidence;
  }
  
  /**
   * Create freshness evidence from a medication decision.
   */
  private createEvidenceFromMedicationDecision(med: DecisionMedicationInfo): FreshnessEvidence {
    return createFreshnessEvidence(
      `${med.name}-${med.decision_date}`,
      'medication_current_state',
      med.decision_date,
      `Current medication state: ${med.name} ${med.dose ?? ''} ${med.frequency ?? ''} (${med.status})`,
      0.9
    );
   }
   private isVerifiedRecently(
     medicationName: string,
     decisions: DecisionMemoryEntry[],
     events: CareEventRecord[]
   ): boolean {
     const now = new Date();
     const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
     
     // Check decisions
     for (const decision of decisions) {
       const decisionDate = new Date(decision.decision_date);
       if (decisionDate >= thirtyDaysAgo) {
         // Check if this decision is related to our medication
         const decisionText = (decision.decision_description ?? decision.decision ?? '').toLowerCase();
         if (decisionText.includes(medicationName.toLowerCase())) {
           return true;
         }
       }
     }
     
     // Check events
     for (const event of events) {
       const eventDate = new Date((event.occurred_at ?? event.created_at) ?? '');
       if (eventDate >= thirtyDaysAgo) {
         // Check if this event is related to our medication
         const eventText = (event.content ?? '').toLowerCase();
         if (eventText.includes(medicationName.toLowerCase())) {
           return true;
         }
       }
     }
     
     return false;
   }
 }

/**
 * Internal representation of medication information from decisions or events.
 */
interface DecisionMedicationInfo {
  name: string;
  dose?: string;
  frequency?: string;
  status: 'new' | 'continuing' | 'discontinued' | 'dosage_changed' | 'unknown';
  decision_date: string;
  source: 'decision' | 'event';
}

/**
 * Internal representation of the current medication state.
 */
interface MedicationState {
  medications: DecisionMedicationInfo[];
}