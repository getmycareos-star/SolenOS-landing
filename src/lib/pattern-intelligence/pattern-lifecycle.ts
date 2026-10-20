/**
 * Pattern Candidate vs Verified Pattern Lifecycle for SolenOS
 * Implements the lifecycle management of patterns as they transition from
 * candidate patterns to verified patterns based on user verification,
 * with support for evolution, rejection, and re-evaluation as specified
 * in points 10, 21-22, 23, 34-35, 45-46 of the specification.
 */

import type { EnhancedPattern } from "./pattern-models";
import type { PatternDetectionResult } from "./pattern-detection-engine";
import type { PatternVerificationInput } from "./pattern-models";
import type { JourneyGraphEvent } from "../care-journey-graph/types";

/**
 * Pattern Lifecycle State Transitions
 */
export type PatternLifecycleTransition = {
  from: PatternLifecycleState;
  to: PatternLifecycleState;
  trigger: string;
  caregiver_id: string;
  timestamp: string;
  description: string;
};

export type PatternLifecycleState =
  | "initial_candidate" // First time detected as candidate
  | "candidate" // Current candidate pattern
  | "verified" // Caregiver confirmed the pattern
  | "rejected" // Caregiver rejected the pattern
  | "uncertain" // Insufficient evidence, needs more observation
  | "contradicted" // New evidence contradicts the pattern
  | "superseded" // Pattern replaced by better evidence/pattern
  | "archived" // Pattern no longer active but retained for history;

/**
 * Pattern Evolution Record - tracks how patterns change over time
 */
export type PatternEvolutionRecord = {
  pattern_id: string;
  version: number;
  timestamp: string;
  change_type: "strengthened" | "weakened" | "modified" | "superseded" | "reopened";
  trigger: "new_evidence" | "user_verification" | "contradictory_evidence" | "time_passed";
  description: string;
  evidence_added: string[]; // Event IDs of new evidence
  evidence_removed: string[]; // Event IDs of removed evidence
  confidence_change: number; // Positive = increased, negative = decreased
};

/**
 * Pattern Lifecycle Manager
 */
export class PatternLifecycleManager {
  private patterns: Map<string, EnhancedPattern> = new Map();
  private lifecycleHistory: Map<string, PatternLifecycleTransition[]> = new Map();
  private evolutionHistory: Map<string, PatternEvolutionRecord[]> = new Map();

  /**
   * Register a newly detected pattern
   */
  public registerPattern(pattern: EnhancedPattern): void {
    // Ensure it starts as a candidate
    pattern.status = "candidate";
    pattern.identity.version = 1;
    pattern.identity.created_at = new Date().toISOString();
    pattern.identity.updated_at = pattern.identity.created_at;
    
    // Initialize verification status
    pattern.user_response = {
      confirmed: false,
      rejected: false,
      not_sure: false,
      corrections_made: false,
      context_added: false,
      last_verification_date: null
    };
    pattern.verification_status = "candidate";
    
    // Add initial audit entry
    pattern.audit_history = [{
      timestamp: pattern.identity.created_at,
      action: "detected",
      actor: "system",
      details: `Pattern initially detected as candidate with ${pattern.supporting_evidence.length} supporting observations`
    }];
    
    // Store the pattern
    this.patterns.set(pattern.identity.id, pattern);
    
    // Initialize lifecycle history
    this.lifecycleHistory.set(pattern.identity.id, [{
      from: "null",
      to: "initial_candidate",
      trigger: "initial_detection",
      caregiver_id: "system",
      timestamp: pattern.identity.created_at,
      description: `Pattern detected from ${pattern.supporting_evidence.length} observations`
    }]);
    
    // Initialize evolution history
    this.evolutionHistory.set(pattern.identity.id, []);
  }

  /**
   * Update pattern with new evidence and re-evaluate its status
   */
  public async updatePatternWithEvidence(
    patternId: string,
    newEvidence: SupportingEvidence[],
    allEvents: JourneyGraphEvent[],
    caregiverId: string
  ): Promise<EnhancedPattern | null> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;
    
    const now = new Date().toISOString();
    
    // Combine existing and new evidence
    const allEvidence = [...pattern.supporting_evidence, ...newEvidence];
    
    // Remove duplicates based on event ID
    const uniqueEvidence = allEvidence.filter(
      (ev, index, self) => 
        index === self.findIndex(e => e.event_id === ev.event_id)
    );
    
    // Create updated pattern with new evidence
    const updatedPattern = await this.recreatePatternWithEvidence(
      uniqueEvidence,
      pattern.category,
      caregiverId,
      patternId
    );
    
    if (!updatedPattern) return null;
    
    // Preserve verification status if it was explicitly set by user
    // Unless new evidence strongly contradicts the pattern
    const oldVerificationStatus = pattern.verification_status;
    const verificationPreserved = 
      oldVerificationStatus === "verified" || 
      oldVerificationStatus === "rejected";
    
    // If pattern was verified/rejected by user, we need to check if 
    // new evidence contradicts it significantly
    let shouldOverrideVerification = false;
    let contradictionReason = "";
    
    if (verificationPreserved) {
      // Check for significant contradictions
      const contradictionCheck = this.checkForContradictions(
        pattern,
        updatedPattern
      );
      
      if (contradictionCheck.isContradicted && contradictionCheck.strength > 0.7) {
        shouldOverrideVerification = true;
        contradictionReason = contradictionCheck.reason;
      }
    }
    
    // Update the pattern
    const finalPattern = { ...updatedPattern };
    
    // Handle verification status
    if (shouldOverrideVerification) {
      // New evidence contradicts user verification
      finalPattern.verification_status = "contradicted";
      finalPattern.user_response = {
        ...finalPattern.user_response,
        confirmed: false,
        rejected: false,
        not_sure: true, // Mark as uncertain due to contradiction
        last_verification_date: now
      };
      
      // Add contradiction to audit
      finalPattern.audit_history.push({
        timestamp: now,
        action: "contradicted_by_evidence",
        actor: "system",
        details: contradictionReason,
        previous_version: pattern.identity.version
      });
    } else if (verificationPreserved) {
      // Preserve user's verification decision
      finalPattern.verification_status = oldVerificationStatus;
      // Keep user response largely intact but update timestamp
      finalPattern.user_response.last_verification_date = now;
    } else {
      // No prior verification or verification was overridden
      // Status remains based on evidence (candidate, uncertain, etc.)
      // The verification status will be determined by evidence evaluation elsewhere
    }
    
    // Update identity
    finalPattern.identity.updated_at = now;
    finalPattern.identity.version += 1;
    
    // Add evolution record
    const evolutionRecord: PatternEvolutionRecord = {
      pattern_id: patternId,
      version: finalPattern.identity.version,
      timestamp: now,
      change_type: this.determineChangeType(pattern, updatedPattern),
      trigger: newEvidence.length > 0 ? "new_evidence" : "no_change",
      description: `Pattern updated with ${newEvidence.length} new observations`,
      evidence_added: newEvidence.map(ev => ev.event_id),
      evidence_removed: [], // Would track removed evidence in full implementation
      confidence_change: finalPattern.confidence === pattern.confidence ? 0 :
                        finalPattern.confidence > pattern.confidence ? 
                          finalPattern.confidence - pattern.confidence :
                          -(pattern.confidence - finalPattern.confidence)
    };
    
    const evolutionList = this.evolutionHistory.get(patternId) ?? [];
    evolutionList.push(evolutionRecord);
    this.evolutionHistory.set(patternId, evolutionList);
    
    // Add to audit history
    finalPattern.audit_history.push({
      timestamp: now,
      action: "updated_with_evidence",
      actor: "system",
      details: `Pattern updated with ${newEvidence.length} new observations, total: ${finalPattern.supporting_evidence.length}`,
      previous_version: pattern.identity.version
    });
    
    // Record lifecycle transition if verification status changed significantly
    if (finalPattern.verification_status !== pattern.verification_status && 
        !shouldOverrideVerification) { // Don't record if we overrode verification
      
      const lifecycleTransition: PatternLifecycleTransition = {
        from: pattern.verification_status as PatternLifecycleState,
        to: finalPattern.verification_status as PatternLifecycleState,
        trigger: "evidence_update",
        caregiver_id: caregiverId,
        timestamp: now,
        description: `Pattern re-evaluated with new evidence: ${pattern.verification_status} → ${finalPattern.verification_status}`
      };
      
      const lifecycleList = this.lifecycleHistory.get(patternId) ?? [];
      lifecycleList.push(lifecycleTransition);
      this.lifecycleHistory.set(patternId, lifecycleList);
    }
    
    // Store updated pattern
    this.patterns.set(patternId, finalPattern);
    
    return finalPattern;
  }

  /**
   * Process user verification input and update pattern accordingly
   */
  public processUserVerification(
    patternId: string,
    verificationInput: PatternVerificationInput
  ): EnhancedPattern | null {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;
    
    const now = new Date().toISOString();
    const updatedPattern = { ...pattern };
    
    // Process the verification action
    const verifiedPattern = this.verifyPattern(
      updatedPattern,
      verificationInput
    );
    
    // Update identity
    verifiedPattern.identity.updated_at = now;
    verifiedPattern.identity.version += 1;
    
    // Add evolution record for user verification
    const evolutionRecord: PatternEvolutionRecord = {
      pattern_id: patternId,
      version: verifiedPattern.identity.version,
      timestamp: now,
      change_type: verificationInput.action === "confirm" ? "strengthened" :
                   verificationInput.action === "reject" ? "weakened" : 
                   verificationInput.action === "not_sure" ? "modified" : "modified",
      trigger: "user_verification",
      description: `Pattern ${verificationInput.action}ed by caregiver`,
      evidence_added: [],
      evidence_removed: [],
      confidence_change: 0 // User verification doesn't change confidence directly
    };
    
    const evolutionList = this.evolutionHistory.get(patternId) ?? [];
    evolutionList.push(evolutionRecord);
    this.evolutionHistory.set(patternId, evolutionList);
    
    // Add to audit history
    verifiedPattern.audit_history.push({
      timestamp: now,
      action: `user_${verificationInput.action}`,
      actor: verificationInput.caregiver_id,
      details: `Caregiver ${verificationInput.action}ed the pattern`,
      previous_version: pattern.identity.version
    });
    
    // Record lifecycle transition
    const lifecycleTransition: PatternLifecycleTransition = {
      from: pattern.verification_status as PatternLifecycleState,
      to: verifiedPattern.verification_status as PatternLifecycleState,
      trigger: "user_verification",
      caregiver_id: verificationInput.caregiver_id,
      timestamp: now,
      description: `Caregiver ${verificationInput.action}ed pattern: ${pattern.verification_status} → ${verifiedPattern.verification_status}`
    };
    
    const lifecycleList = this.lifecycleHistory.get(patternId) ?? [];
    lifecycleList.push(lifecycleTransition);
    this.lifecycleHistory.set(patternId, lifecycleList);
    
    // Store updated pattern
    this.patterns.set(patternId, verifiedPattern);
    
    return verifiedPattern;
  }

  /**
   * Check if pattern has been superseded by better evidence or alternative pattern
   */
  public checkForSupersession(
    patternId: string,
    currentPatterns: EnhancedPattern[]
  ): { isSuperseded: boolean; supersedingPatternId: string | null; reason: string } {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return { isSuperseded: false, supersedingPatternId: null, reason: "Pattern not found" };
    
    // Don't supersede patterns that have been explicitly verified by user
    // unless there's very strong contradictory evidence
    if (pattern.verification_status === "verified") {
      return { isSuperseded: false, supersedingPatternId: null, reason: "Verified patterns resist supersession without strong contradiction" };
    }
    
    // Look for patterns of same category that better explain the evidence
    const sameCategoryPatterns = currentPatterns.filter(
      p => p.category === pattern.category && p.identity.id !== patternId
    );
    
    if (sameCategoryPatterns.length === 0) {
      return { isSuperseded: false, supersedingPatternId: null, reason: "No competing patterns of same category" };
    }
    
    // Find the pattern with highest confidence that explains similar evidence
    const bestPattern = sameCategoryPatterns.reduce((best, current) => {
      // Simple heuristic: higher confidence and more evidence is better
      const currentScore = current.confidence * Math.log(current.supporting_evidence.length + 1);
      const bestScore = best.confidence * Math.log(best.supporting_evidence.length + 1);
      return currentScore > bestScore ? current : best;
    }, sameCategoryPatterns[0]);
    
    // Only consider superseding if the new pattern is significantly better
    const currentScore = pattern.confidence * Math.log(pattern.supporting_evidence.length + 1);
    const bestScore = bestPattern.confidence * Math.log(bestPattern.supporting_evidence.length + 1);
    
    if (bestScore > currentScore * 1.5) { // 50% better
      return {
        isSuperseded: true,
        supersedingPatternId: bestPattern.identity.id,
        reason: `Pattern superseded by better explanation with higher confidence (${bestPattern.confidence.toFixed(2)} vs ${pattern.confidence.toFixed(2)}) and more evidence (${bestPattern.supporting_evidence.length} vs ${pattern.supporting_evidence.length} observations)`
      };
    }
    
    return { isSuperseded: false, supersedingPatternId: null, reason: "No sufficiently better pattern found" };
  }

  /**
   * Get pattern lifecycle history
   */
  public getLifecycleHistory(patternId: string): PatternLifecycleTransition[] {
    return this.lifecycleHistory.get(patternId) ?? [];
  }

  /**
   * Get pattern evolution history
   */
  public getEvolutionHistory(patternId: string): PatternEvolutionRecord[] {
    return this.evolutionHistory.get(patternId) ?? [];
  }

  // Private helper methods
  
  private verifyPattern(
    pattern: EnhancedPattern,
    verificationInput: PatternVerificationInput
  ): EnhancedPattern {
    const updatedPattern = { ...pattern };
    
    switch (verificationInput.action) {
      case "confirm":
        updatedPattern.user_response.confirmed = true;
        updatedPattern.user_response.rejected = false;
        updatedPattern.user_response.not_sure = false;
        updatedPattern.verification_status = "verified";
        break;
        
      case "reject":
        updatedPattern.user_response.confirmed = false;
        updatedPattern.user_response.rejected = true;
        updatedPattern.user_response.not_sure = false;
        updatedPattern.verification_status = "rejected";
        break;
        
      case "not_sure":
        updatedPattern.user_response.confirmed = false;
        updatedPattern.user_response.rejected = false;
        updatedPattern.user_response.not_sure = true;
        updatedPattern.verification_status = "uncertain";
        break;
        
      case "correct":
        // Apply corrections if provided
        if (verificationInput.corrections) {
          const corrections = verificationInput.corrections;
          
          // Update event IDs if provided
          if (corrections.event_ids) {
            // In a full implementation, we would map the corrected event IDs
            // to the supporting evidence
            updatedPattern.user_response.corrections_made = true;
          }
          
          // Update dates if provided
          if (corrections.dates) {
            // Update supporting evidence dates
            updatedPattern.supporting_evidence = updatedPattern.supporting_evidence.map(ev => ({
              ...ev,
              date: corrections.dates[ev.event_id] ?? ev.date
            }));
            updatedPattern.user_response.corrections_made = true;
          }
          
          // Add context if provided
          if (corrections.context) {
            if (!updatedPattern.context) {
              updatedPattern.context = {
                description: corrections.context,
                timing: new Date().toISOString(),
                source: "caregiver_input",
              };
            } else {
              // Append to existing context
              updatedPattern.context.description += `\n${corrections.context}`;
            }
            updatedPattern.user_response.context_added = true;
          }
          
          // Update interpretation if provided
          if (corrections.interpretation) {
            // Add as alternative interpretation or update existing
            updatedPattern.alternative_interpretations.push({
              description: corrections.interpretation,
              supporting_evidence: updatedPattern.supporting_evidence.map(ev => ev.event_id),
              confidence: 0.5, // Medium confidence for caregiver-provided interpretation
            });
          }
        }
        
        // Keep status as candidate unless explicitly confirmed/rejected
        if (!updatedPattern.user_response.confirmed && 
            !updatedPattern.user_response.rejected) {
          updatedPattern.verification_status = "candidate";
        }
        break;
        
      case "add_context":
        if (verificationInput.corrections?.context) {
          if (!updatedPattern.context) {
            updatedPattern.context = {
              description: verificationInput.corrections.context,
              timing: new Date().toISOString(),
              source: "caregiver_input",
            };
          } else {
            updatedPattern.context.description += `\n${verificationInput.corrections.context}`;
          }
          updatedPattern.user_response.context_added = true;
        }
        break;
    }
    
    // Update verification timestamp
    updatedPattern.user_response.last_verification_date = 
      verificationInput.timestamp;
    
    return updatedPattern;
  }
  
  private determineChangeType(
    oldPattern: EnhancedPattern,
    newPattern: EnhancedPattern
  ): PatternEvolutionRecord["change_type"] {
    const confidenceDiff = newPattern.confidence - oldPattern.confidence;
    const evidenceDiff = newPattern.supporting_evidence.length - oldPattern.supporting_evidence.length;
    
    if (evidenceDiff > 0 && confidenceDiff > 0.1) {
      return "strengthened";
    } else if (evidenceDiff < 0 || confidenceDiff < -0.1) {
      return "weakened";
    } else if (newPattern.category !== oldPattern.category) {
      return "modified";
    } else {
      // Check if evidence set changed significantly
      const oldEvidenceIds = new Set(oldPattern.supporting_evidence.map(ev => ev.event_id));
      const newEvidenceIds = new Set(newPattern.supporting_evidence.map(ev => ev.event_id));
      const intersectionSize = [...oldEvidenceIds].filter(id => newEvidenceIds.has(id)).length;
      const unionSize = oldEvidenceIds.size + newEvidenceIds.size - intersectionSize;
      const similarity = unionSize > 0 ? intersectionSize / unionSize : 1;
      
      if (similarity < 0.7) { // Less than 70% overlap in evidence
        return "modified";
      }
      
      return "strengthened"; // Default to strengthened if evidence increased slightly
    }
  }
  
  private checkForContradictions(
    oldPattern: EnhancedPattern,
    newPattern: EnhancedPattern
  ): { isContradicted: boolean; strength: number; reason: string } {
    // Check if the new pattern fundamentally contradicts the old one
    // This is a simplified implementation
    
    // Check for opposite confidence change
    const confidenceDiff = newPattern.confidence - oldPattern.confidence;
    const evidenceDiff = newPattern.supporting_evidence.length - oldPattern.supporting_evidence.length;
    
    let isContradicted = false;
    let strength = 0;
    let reason = "";
    
    // Strong contradiction: high confidence pattern rejected by new evidence
    if (oldPattern.confidence > 0.7 && newPattern.confidence < 0.3 && evidenceDiff <= 0) {
      isContradicted = true;
      strength = 0.8 + (0.2 * (1 - newPattern.confidence)); // Strength increases as new confidence decreases
      reason = f"High confidence pattern (${oldPattern.confidence.toFixed(2)}) contradicted by new evidence with low confidence (${newPattern.confidence.toFixed(2)})";
    }
    // Moderate contradiction: significant evidence reduction with confidence drop
    else if (evidenceDiff < -2 && confidenceDiff < -0.2) {
      isContradicted = true;
      strength = Math.min(0.7, Math.abs(confidenceDiff) + Math.min(Math.abs(evidenceDiff) * 0.1, 0.3));
      reason = f"Pattern evidence reduced by {Math.abs(evidenceDiff)} observations with confidence drop of {Math.abs(confidenceDiff).toFixed(2)}";
    }
    // Category change can indicate contradiction
    else if (newPattern.category !== oldPattern.category) {
      isContradicted = true;
      strength = 0.6;
      reason = f"Pattern category changed from {oldPattern.category} to {newPattern.category}";
    }
    
    return {
      isContradicted,
      strength,
      reason
    };
  }
  
  private async recreatePatternWithEvidence(
    evidence: SupportingEvidence[],
    category: string,
    caregiverId: string,
    patternId: string
  ): Promise<EnhancedPattern | null> {
    // This would reuse the pattern detection logic but with specific evidence
    // For now, we'll return null to indicate this needs to be implemented
    // with access to the pattern detection engine
    return null; // Placeholder
  }
}

// Export singleton instance
export const patternLifecycleManager = new PatternLifecycleManager();