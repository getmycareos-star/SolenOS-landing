import type { DecisionMemoryEntry } from "../decision-memory/index";
import type { CareEventRecord } from "../care-events/types";
import type { MedicationInfo } from "../document-intelligence/types";
import { listDecisionMemory } from "../decision-memory";
import { CareRecordSearchResult } from "../care-record/types";

/**
 * The freshness status of medication information.
 */
export type MedicationFreshnessStatus =
  | "CURRENT"       // The medication information is current and verified
  | "STALE"         // The medication information may no longer be current
  | "SUPERSEDED"    // The medication information has been superseded by newer information
  | "HISTORICAL"    // The medication information is historical (describes a past state)
  | "UNKNOWN"       // The currentness of the medication information cannot be determined
  | "CONFLICTING";  // Available evidence disagrees about the current state

/**
 * Represents a medication item with its freshness assessment.
 */
export type MedicationWithFreshness = {
  /** The medication information (name, dose, etc.) */
  medication: MedicationInfo;
  /** The freshness status */
  freshness: MedicationFreshnessStatus;
  /** The evidence supporting the freshness assessment */
  evidence: string[];
  /** A human-readable reason for the freshness assessment */
  reason: string;
  /** The timestamp when the freshness was assessed */
  assessedAt: string;
};

/**
 * Evaluates the freshness of medication information based on decisions and care events.
 */
export class MedicationFreshnessEvaluator {
  /**
   * Evaluate the freshness of medication information for a care recipient.
   * 
   * @param careKey The care key for the care recipient
   * @param medications Medication information to assess (e.g., from extracted documents)
   * @param careEvents Optional care events to consider (if not provided, will be fetched)
   * @returns Freshness assessment for each medication
   */
  async evaluateFreshness(
    careKey: string,
    medications: MedicationInfo[],
    careEvents?: CareEventRecord[]
  ): Promise<MedicationWithFreshness[]> {
    // Load decision memory for the care recipient
    const decisionEntries = listDecisionMemory(careKey);
    
    // Fetch care events if not provided
    const events = careEvents ?? await this.fetchCareEvents(careKey);
    
    // Determine the current medication state from decisions and events
    const currentState = this.determineCurrentMedicationState(decisionEntries, events);
    
    // Assess freshness for each medication
    const results: MedicationWithFreshness[] = [];
    for (const med of medications) {
      const freshness = this.assessMedicationFreshness(med, currentState, decisionEntries, events);
      results.push({
        medication: med,
        freshness: freshness.status,
        evidence: freshness.evidence,
        reason: freshness.reason,
        assessedAt: new Date().toISOString()
      });
    }
    
    return results;
  }
  
  /**
   * Fetch care events for a care recipient.
   * In a full implementation, this would query the care record store.
   * For now, we return an empty array.
   */
  private async fetchCareEvents(careKey: string): Promise<CareEventRecord[]> {
    // TODO: Implement actual fetching from care record store
    return [];
  }
  
  /**
   * Determine the current medication state from decisions and care events.
   */
  private determineCurrentMedicationState(
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): MedicationState {
    // Filter medication-related decisions
    const medicationDecisions = decisions.filter(d => 
      d.decision_type === "medication_started" ||
      d.decision_type === "medication_stopped" ||
      d.decision_type === "medication_changed"
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
    const medicationEvents = events.filter(e => 
      e.event_type === "medication_change" ||
      e.event_type === "medication_started" ||
      e.event_type === "medication_stopped"
    );
    
    // Sort events by date (most recent first)
    const sortedEvents = [...medicationEvents].sort((a, b) => 
      new Date(b.date ?? b.created_at).getTime() - new Date(a.date ?? a.created_at).getTime()
    );
    
    for (const event of sortedEvents) {
      // Extract medication information from the event
      const medInfo = this.extractMedicationInfoFromEvent(event);
      if (!medInfo) continue;
      
      const key = medInfo.name.toLowerCase();
      // If we don't have a current medication from decisions, or if the event is more recent than the decision
      const currentDecision = currentMedications.get(key);
      if (!currentDecision || 
          new Date(event.date ?? event.created_at).getTime() > 
          new Date(currentDecision.decision_date).getTime()) {
        currentMedications.set(key, {
          name: medInfo.name,
          dose: medInfo.dose,
          frequency: medInfo.frequency,
          status: medInfo.status,
          decision_date: event.date ?? event.created_at,
          source: "event"
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
    // This is a simplified implementation - in reality, we would use more sophisticated parsing
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
    let status: "new" | "continuing" | "discontinued" | "dosage_changed" | "unknown" = "unknown";
    if (decision.decision_type === "medication_started") {
      status = "new";
    } else if (decision.decision_type === "medication_stopped") {
      status = "discontinued";
    } else if (decision.decision_type === "medication_changed") {
      status = "dosage_changed";
    }
    
    return {
      name,
      dose,
      frequency,
      status,
      decision_date: decision.decision_date,
      source: "decision"
    };
  }
  
  /**
   * Extract medication information from a care event.
   */
  private extractMedicationInfoFromEvent(event: CareEventRecord): DecisionMedicationInfo | null {
    // The care event's structured field may contain medication information
    const structured = event.structured as any; // TODO: proper typing
    
    // Look for medication information in the structured event
    // This is highly dependent on how medication change events are structured
    // For now, we return null as a placeholder
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
      const discontinued = this.isMedicationDiscontinued(medication.name, decisions, events);
      if (discontinued) {
        return {
          status: "SUPERSEDED",
          evidence: [discontinued],
          reason: "Medication has been discontinued per recent decision or event"
        };
      }
      
      // Check if there is conflicting evidence
      const conflicting = this.hasConflictingEvidence(medication.name, decisions, events);
      if (conflicting) {
        return {
          status: "CONFLICTING",
          evidence: conflicting,
          reason: "Conflicting evidence exists about this medication's current status"
        };
      }
      
      // If no evidence of discontinuation or conflict, it might be historical
      return {
        status: "HISTORICAL",
        evidence: [],
        reason: "Medication not found in current state; may be historical"
      };
    }
    
    // Medication found in current state - check if it matches
    const matches = this.medicationMatchesCurrentState(medication, currentMed);
    if (matches) {
      return {
        status: "CURRENT",
        evidence: [currentMed.decision_date],
        reason: "Medication matches current state"
      };
    }
    
    // Check if the medication has been superseded by a more recent decision or event
    const supersededBy = this.findSupersedingEvidence(medication.name, decisions, events);
    if (supersededBy) {
      return {
        status: "SUPERSEDED",
        evidence: supersededBy,
        reason: "Medication has been superseded by newer information"
      };
    }
    
    // Check for conflicting evidence
    const conflicting = this.hasConflictingEvidence(medication.name, decisions, events);
    if (conflicting) {
      return {
        status: "CONFLICTING",
        evidence: conflicting,
        reason: "Conflicting evidence exists about this medication's current status"
      };
    }
    
    // Default to stale if we can't determine
    return {
      status: "STALE",
      evidence: [],
      reason: "Unable to determine currentness; requires verification"
    };
  }
  
  /**
   * Check if there is evidence that a medication has been discontinued.
   */
  private isMedicationDiscontinued(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): string | null {
    // Look for discontinuation decisions or events
    const lowerName = medicationName.toLowerCase();
    
    for (const decision of decisions) {
      if (decision.decision_type === "medication_stopped") {
        const medInfo = this.extractMedicationInfoFromDecision(decision);
        if (medInfo && medInfo.name.toLowerCase() === lowerName) {
          return decision.id;
        }
      }
    }
    
    for (const event of events) {
      if (event.event_type === "medication_stopped") {
        const medInfo = this.extractMedicationInfoFromEvent(event);
        if (medInfo && medInfo.name.toLowerCase() === lowerName) {
          return event.id;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if there is conflicting evidence about a medication.
   */
  private hasConflictingEvidence(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): string[] | null {
    const lowerName = medicationName.toLowerCase();
    const evidence: string[] = [];
    
    // Look for both started and stopped decisions for the same medication without clear supersession
    const startedDecisions = decisions.filter(d => 
      d.decision_type === "medication_started" &&
      this.extractMedicationInfoFromDecision(d)?.name.toLowerCase() === lowerName
    );
    
    const stoppedDecisions = decisions.filter(d => 
      d.decision_type === "medication_stopped" &&
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
        evidence.push(...startedDecisions.map(d => d.id));
        evidence.push(...stoppedDecisions.map(d => d.id));
        return evidence;
      }
    }
    
    // Check for both dosage changed and continuing evidence
    // TODO: Implement more sophisticated conflict detection
    
    return evidence.length > 0 ? evidence : null;
  }
  
  /**
   * Check if a medication matches the current state.
   */
  private medicationMatchesCurrentState(
    medication: MedicationInfo,
    currentMed: DecisionMedicationInfo
  ): boolean {
    // Compare name
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
    
    // Compare status - allow some flexibility
    // For example, a "continuing" medication in the extracted info might match a "new" decision if the decision is recent
    // This is simplified - in reality, we would need more sophisticated matching
    return true;
  }
  
  /**
   * Find evidence that supersedes a medication.
   */
  private findSupersedingEvidence(
    medicationName: string,
    decisions: DecisionMemoryEntry[],
    events: CareEventRecord[]
  ): string[] | null {
    const lowerName = medicationName.toLowerCase();
    const evidence: string[] = [];
    
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
          evidence.push(decision.id);
          // Also add the superseded decisions for context
          evidence.push(...supersededDecisions.map(d => d.id));
          return evidence;
        }
      }
    }
    
    // TODO: Check events for superseding evidence
    
    return evidence.length > 0 ? evidence : null;
  }
}

/**
 * Internal representation of medication information from decisions or events.
 */
interface DecisionMedicationInfo {
  name: string;
  dose?: string;
  frequency?: string;
  status: "new" | "continuing" | "discontinued" | "dosage_changed" | "unknown";
  decision_date: string;
  source: "decision" | "event";
}

/**
 * Internal representation of the current medication state.
 */
interface MedicationState {
  medications: DecisionMedicationInfo[];
}

/**
 * Internal representation of a freshness assessment.
 */
interface FreshnessAssessment {
  status: MedicationFreshnessStatus;
  evidence: string[];
  reason: string;
}