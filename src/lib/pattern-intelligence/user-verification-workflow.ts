/**
 * User Verification Workflow for SolenOS Pattern Recognition
 * Implements the caregiver interaction patterns for verifying, rejecting,
 * correcting, and adding context to patterns as specified in points 22, 23
 * of the pattern recognition specification.
 */

import type { EnhancedPattern } from "./pattern-models";
import type { PatternVerificationInput } from "./pattern-models";
import { patternLifecycleManager } from "./pattern-lifecycle";

/**
 * Verification Action Types
 */
export type VerificationAction =
  | "confirm"
  | "reject"
  | "not_sure"
  | "correct"
  | "add_context";

/**
 * Verification UI State
 */
export type VerificationUIState = {
  patternId: string;
  currentStep: "review" | "action" | "correction" | "context" | "complete";
  selectedAction: VerificationAction | null;
  correctionData: {
    eventIds?: string[];
    dateChanges?: Record<string, string>;
    contextAddition?: string;
    interpretationChange?: string;
  };
  contextInput: string;
  isSubmitting: boolean;
  submitError: string | null;
};

/**
 * Verification Result
 */
export type VerificationResult = {
  success: boolean;
  pattern: EnhancedPattern | null;
  message: string;
  actionTaken: VerificationAction;
};

/**
 * User Verification Workflow Manager
 */
export class UserVerificationWorkflow {
  /**
   * Present a pattern to the caregiver for verification
   */
  public static presentPatternForVerification(
    pattern: EnhancedPattern
  ): {
    title: string;
    description: string;
    evidenceSummary: string;
    temporalSummary: string;
    confidenceInfo: string;
    uncertaintyInfo: string;
    causationDisclaimer: string;
    suggestedActions: VerificationAction[];
  } {
    return {
      title: `Review Pattern: ${pattern.label}`,
      description: pattern.description,
      evidenceSummary: this.formatEvidenceSummary(pattern),
      temporalSummary: this.formatTemporalSummary(pattern),
      confidenceInfo: this.formatConfidenceInfo(pattern),
      uncertaintyInfo: this.formatUncertaintyInfo(pattern),
      causationDisclaimer: "⚠️ Important: This pattern describes observed recurrence only. The underlying cause is not established.",
      suggestedActions: this.getSuggestedActions(pattern)
    };
  }

  /**
   * Format evidence summary for display
   */
  private static formatEvidenceSummary(pattern: EnhancedPattern): string {
    const sources = [...new Set(pattern.supporting_evidence.map(ev => ev.source))];
    const sourceTypes = [...new Set(pattern.supporting_evidence.map(ev => ev.source_type))];
    
    return `
    • Total Observations: ${pattern.supporting_evidence.length}
    • Unique Sources: ${sources.length} (${sources.join(", ")})
    • Source Types: ${sourceTypes.length} (${sourceTypes.join(", ")})
    • Date Range: ${pattern.recurrence_characterities.first_occurrence} to ${pattern.recurrence_characterities.last_occurrence}
    `.trim();
  }

  /**
   * Format temporal summary for display
   */
  private static formatTemporalSummary(pattern: EnhancedPattern): string {
    const chars = pattern.recurrence_characterities;
    return `
    • First Observed: ${chars.first_occurrence}
    • Last Observed: ${chars.last_occurrence}
    • Occurrence Count: ${chars.occurrence_count}
    ${chars.average_interval_days ? `• Average Interval: ${chars.average_interval_days.toFixed(1)} days` : ""}
    ${chars.clustering_score !== undefined ? `• Clustering Score: ${(chars.clustering_score * 100).toFixed(0)}%` : ""}
    ${chars.persistence_score !== undefined ? `• Persistence Score: ${(chars.persistence_score * 100).toFixed(0)}%` : ""}
    `.trim();
  }

  /**
   * Format confidence information for display
   */
  private static formatConfidenceInfo(pattern: EnhancedPattern): string {
    const confidenceLabels = { high: "High", medium: "Medium", low: "Low" };
    const label = confidenceLabels[pattern.confidence as keyof typeof confidenceLabels] || pattern.confidence;
    
    return `
    • Confidence Level: ${label} (${(pattern.confidence * 100).toFixed(0)}%)
    • What We Know: Pattern describes recurring observations
    • What We Don't Know: ${pattern.uncertainty}
    `.trim();
  }

  /**
   * Format uncertainty information for display
   */
  private static formatUncertaintyInfo(pattern: EnhancedPattern): string {
    return `
    • Causation Status: ${pattern.causation_status} (pattern ≠ causation)
    • Alternative Interpretations: ${pattern.alternative_interpretations.length} possible
    • Verification Status: ${pattern.verification_status}
    ${pattern.user_response.last_verification_date ? 
      `• Last Reviewed: ${new Date(pattern.user_response.last_verification_date).toLocaleDateString()}` : ""}
    `.trim();
  }

  /**
   * Get suggested verification actions based on pattern state
   */
  private static getSuggestedActions(pattern: EnhancedPattern): VerificationAction[] {
    const actions: VerificationAction[] = [];
    
    // Always available actions
    actions.push("confirm");
    actions.push("reject");
    actions.push("not_sure");
    
    // Context-dependent actions
    if (pattern.verification_status === "candidate" || 
        pattern.verification_status === "uncertain" ||
        pattern.verification_status === "contradicted") {
      actions.push("correct");
      actions.push("add_context");
    }
    
    return actions;
  }

  /**
   * Create verification input from UI state
   */
  public static createVerificationInput(
    patternId: string,
    action: VerificationAction,
    caregiverId: string,
    correctionData: {
      eventIds?: string[];
      dateChanges?: Record<string, string>;
      contextAddition?: string;
      interpretationChange?: string;
    } = {}
  ): PatternVerificationInput {
    return {
      pattern_id: patternId,
      action,
      caregiver_id: caregiverId,
      timestamp: new Date().toISOString(),
      corrections: correctionData
    };
  }

  /**
   * Process verification action through the lifecycle manager
   */
  public static async processVerification(
    verificationInput: PatternVerificationInput
  ): Promise<VerificationResult> {
    try {
      // Process the verification through lifecycle manager
      const updatedPattern = patternLifecycleManager.processUserVerification(
        verificationInput.pattern_id,
        verificationInput
      );
      
      if (!updatedPattern) {
        return {
          success: false,
          pattern: null,
          message: "Pattern not found or could not be processed",
          actionTaken: verificationInput.action
        };
      }
      
      // Generate appropriate message based on action
      let message = "";
      switch (verificationInput.action) {
        case "confirm":
          message = "Pattern confirmed. Thank you for your feedback.";
          break;
        case "reject":
          message = "Pattern rejected. We'll update our understanding.";
          break;
        case "not_sure":
          message = "Marked as uncertain. We'll continue monitoring.";
          break;
        case "correct":
          message = "Pattern corrected with your feedback.";
          break;
        case "add_context":
          message = "Context added to pattern.";
          break;
      }
      
      return {
        success: true,
        pattern: updatedPattern,
        message,
        actionTaken: verificationInput.action
      };
    } catch (error) {
      return {
        success: false,
        pattern: null,
        message: `Error processing verification: ${error instanceof Error ? error.message : String(error)}`,
        actionTaken: verificationInput.action
      };
    }
  }

  /**
   * Get verification history for a pattern
   */
  public static getVerificationHistory(
    patternId: string
  ): {
    lifecycleTransitions: any[];
    evolutionRecords: any[];
    currentStatus: string;
  } {
    const lifecycle = patternLifecycleManager.getLifecycleHistory(patternId);
    const evolution = patternLifecycleManager.getEvolutionHistory(patternId);
    
    // Get current pattern status if available
    // In a full implementation, we'd get this from the pattern store
    
    return {
      lifecycleTransitions: lifecycle,
      evolutionRecords: evolution,
      currentStatus: "unknown" // Would be populated from actual pattern
    };
  }

  /**
   * Validate verification input before processing
   */
  public static validateVerificationInput(
    input: PatternVerificationInput
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!input.pattern_id || input.pattern_id.trim() === "") {
      errors.push("Pattern ID is required");
    }
    
    if (!input.action || 
        !["confirm", "reject", "not_sure", "correct", "add_context"].includes(input.action)) {
      errors.push("Valid action is required (confirm, reject, not_sure, correct, add_context)");
    }
    
    if (!input.caregiver_id || input.caregiver_id.trim() === "") {
      errors.push("Caregiver ID is required");
    }
    
    if (!input.timestamp) {
      errors.push("Timestamp is required");
    } else {
      // Validate timestamp format
      const date = new Date(input.timestamp);
      if (isNaN(date.getTime())) {
        errors.push("Timestamp must be a valid ISO date string");
      }
    }
    
    // Validate corrections if provided
    if (input.corrections) {
      const corrections = input.corrections;
      
      if (corrections.event_ids && !Array.isArray(corrections.event_ids)) {
        errors.push("Event IDs correction must be an array");
      }
      
      if (corrections.dateChanges && typeof corrections.dateChanges !== "object") {
        errors.push("Date changes correction must be an object");
      }
      
      if (corrections.contextAddition && typeof corrections.contextAddition !== "string") {
        errors.push("Context addition must be a string");
      }
      
      if (corrections.interpretationChange && typeof corrections.interpretationChange !== "string") {
        errors.push("Interpretation change must be a string");
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format verification result for display to caregiver
   */
  public static formatVerificationResultForDisplay(
    result: VerificationResult
  ): {
    title: string;
    message: string;
    patternStatus: string;
    nextSteps: string[];
  } {
    let title = "Verification Complete";
    let message = result.message;
    let patternStatus = result.pattern ? 
      `Pattern status: ${result.pattern.verification_status}` : 
      "Pattern processing failed";
    
    const nextSteps: string[] = [];
    
    if (result.success) {
      switch (result.actionTaken) {
        case "confirm":
          nextSteps.push("Pattern is now verified and will be used for insights");
          nextSteps.push("You can continue to monitor for changes");
          break;
        case "reject":
          nextSteps.push("Pattern has been rejected and will not be used for insights");
          nextSteps.push("Similar patterns will be re-evaluated");
          break;
        case "not_sure":
          nextSteps.push("Pattern marked as uncertain - we'll continue gathering evidence");
          nextSteps.push("Check back later for updates");
          break;
        case "correct":
          nextSteps.push("Pattern has been updated with your corrections");
          nextSteps.push("Review the updated pattern to ensure accuracy");
          break;
        case "add_context":
          nextSteps.push("Context has been added to the pattern");
          nextSteps.push("This will help improve future pattern detection");
          break;
      }
    } else {
      nextSteps.push("Please try again or contact support if the issue persists");
    }
    
    return {
      title,
      message,
      patternStatus,
      nextSteps
    };
  }
}

/**
 * Hook for React components to manage verification state
 */
// This would be a React hook in a real implementation
export function usePatternVerification(patternId: string) {
  // Placeholder for React hook implementation
  return {
    verificationState: {
      patternId,
      currentStep: "review",
      selectedAction: null,
      correctionData: {},
      contextInput: "",
      isSubmitting: false,
      submitError: null
    },
    actions: {
      selectAction: (action: VerificationAction) => {},
      updateCorrectionData: (data: any) => {},
      updateContextInput: (input: string) => {},
      submitVerification: async () => ({ success: false, pattern: null, message: "Not implemented", actionTaken: "confirm" }),
      reset: () => {}
    }
  };
}