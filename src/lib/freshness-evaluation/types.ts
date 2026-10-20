/**
 * Freshness Evaluation System for SolenOS
 * Implements the Stale Information workflow as specified in Day 17
 */

/**
 * The fundamental states of information freshness in SolenOS.
 * These states are mutually exclusive and collectively exhaustive.
 */
export type FreshnessState =
  | 'STORED'        // The information exists in the Care Record
  | 'CURRENT'       // The information currently represents the known care state
  | 'VERIFIED'      // The information has been explicitly confirmed by an authorized person/source
  | 'STALE'         // The information may no longer represent the current real-world state
  | 'HISTORICAL'    // The information is intentionally retained because it describes a previous state
  | 'SUPERSEDED'    // A newer supported state replaced it
  | 'EXPIRED'       // The information had an explicit validity period that has ended
  | 'UNKNOWN'       // SolenOS cannot establish whether the information remains current
  | 'CONFLICTING';  // Available evidence disagrees about the current state

/**
 * Reasons why information might be considered stale or requiring review.
 * These provide explainability for freshness assessments.
 */
export type StalenessReason =
  | 'NEWER_CONTRADICTORY_EVIDENCE'    // Newer evidence contradicts the information
  | 'SUPERSEDING_INFORMATION'         // Newer information explicitly replaces this
  | 'PASSED_TEMPORAL_STATE'           // Time-bound state has passed (e.g., appointment date)
  | 'EXPLICIT_VALIDITY_PERIOD_ENDED'  // Explicit valid_until date has passed
  | 'CONTEXT_TRANSITION'              // Care context has changed (caregiver, professional, setting, etc.)
  | 'LACK_OF_RECENT_CONFIRMATION'     // No recent confirmation where confirmation is meaningful
  | 'SOURCE_LIMITED_VALIDITY'         // Source explicitly limits validity period
  | 'EVIDENCE_CONFLICT';              // Multiple sources disagree

/**
 * Evidence that supports a freshness assessment.
 * This provides traceability back to the source information.
 */
export type FreshnessEvidence = {
  /** ID of the evidence item (care event, decision, etc.) */
  id: string;
  /** Type of evidence (medication_change, decision, appointment, etc.) */
  type: string;
  /** When the evidence was created/recorded */
  timestamp: string;
  /** Brief description of what the evidence shows */
  description: string;
  /** Confidence in this evidence (0-1) */
  confidence: number;
};

/**
 * The result of a freshness evaluation for a piece of information.
 * This includes the state, reasoning, and supporting evidence.
 */
export type FreshnessAssessment = {
  /** The current freshness state of the information */
  state: FreshnessState;
  /** If STALE, the reason(s) why it's considered stale */
  reasons?: StalenessReason[];
  /** Supporting evidence for this assessment */
  evidence: FreshnessEvidence[];
  /** Human-readable explanation of the assessment */
  explanation: string;
  /** When this assessment was made */
  assessedAt: string;
  /** Version of the care context when this was assessed */
  careContextVersion?: string;
};

/**
 * Information that has been evaluated for freshness.
 * Wraps the original information with its freshness assessment.
 */
export type FreshnessWrapper<T> = {
  /** The original information item */
  item: T;
  /** The freshness assessment for this item */
  freshness: FreshnessAssessment;
};

/**
 * Interface for domain-specific freshness evaluators.
 * Each domain (medication, routine, caregiver, etc.) should implement this.
 */
export interface FreshnessEvaluator<T> {
  /**
   * Evaluate the freshness of an information item.
   * 
   * @param item The information item to evaluate
   * @param context Additional context needed for evaluation (care context, related evidence, etc.)
   * @returns A freshness assessment for the item
   */
  evaluateFreshness(item: T, context: FreshnessEvaluationContext): Promise<FreshnessAssessment>;
  
  /**
   * Get a human-readable description of what this evaluator handles.
   */
  getDomainDescription(): string;
}

/**
 * Context provided to freshness evaluators.
 * Contains information that might be needed to assess freshness.
 */
export type FreshnessEvaluationContext = {
  /** The care key for the care recipient */
  careKey: string;
  /** The current care context (if available) */
  careContext?: any;
  /** Related decisions that might affect freshness */
  relatedDecisions?: any[];
  /** Related care events that might affect freshness */
  relatedEvents?: any[];
  /** Other domain-specific context */
  [key: string]: any;
};

/**
 * Manager for coordinating freshness evaluations across domains.
 * This is the main entry point for the freshness system.
 */
export class FreshnessEvaluationManager {
  private evaluators: Map<string, FreshnessEvaluator<any>> = new Map();
  
  /**
   * Register a freshness evaluator for a specific domain.
   * 
   * @param domainName Identifier for the domain (e.g., 'medication', 'routine')
   * @param evaluator The evaluator implementation
   */
  registerEvaluator(domainName: string, evaluator: FreshnessEvaluator<any>): void {
    this.evaluators.set(domainName, evaluator);
  }
  
  /**
   * Get an evaluator for a specific domain.
   * 
   * @param domainName Identifier for the domain
   * @returns The evaluator if found, undefined otherwise
   */
  getEvaluator(domainName: string): FreshnessEvaluator<any> | undefined {
    return this.evaluators.get(domainName);
  }
  
  /**
   * Evaluate freshness for an item using the appropriate domain evaluator.
   * 
   * @param domainName The domain to evaluate for
   * @param item The item to evaluate
   * @param context Evaluation context
   * @returns Freshness assessment
   */
  async evaluateFreshness<T>(
    domainName: string,
    item: T,
    context: FreshnessEvaluationContext
  ): Promise<FreshnessAssessment> {
    const evaluator = this.evaluators.get(domainName);
    if (!evaluator) {
      throw new Error(`No freshness evaluator registered for domain: ${domainName}`);
    }
    
    return evaluator.evaluateFreshness(item, context);
  }
  
  /**
   * Evaluate freshness for multiple items of the same domain.
   * 
   * @param domainName The domain to evaluate for
   * @param items The items to evaluate
   * @param context Evaluation context
   * @returns Array of freshness wrappers
   */
  async evaluateBatch<T>(
    domainName: string,
    items: T[],
    context: FreshnessEvaluationContext
  ): Promise<FreshnessWrapper<T>[]> {
    const evaluator = this.evaluators.get(domainName);
    if (!evaluator) {
      throw new Error(`No freshness evaluator registered for domain: ${domainName}`);
    }
    
    const results: FreshnessWrapper<T>[] = [];
    for (const item of items) {
      const assessment = await evaluator.evaluateFreshness(item, context);
      results.push({ item, freshness: assessment });
    }
    
    return results;
  }
}

/**
 * Create a basic freshness evidence item from a care event or decision.
 */
export function createFreshnessEvidence(
  id: string,
  type: string,
  timestamp: string,
  description: string,
  confidence: number = 0.8
): FreshnessEvidence {
  return {
    id,
    type,
    timestamp,
    description,
    confidence
  };
}

/**
 * Create a freshness assessment for CURRENT information.
 */
export function createCurrentAssessment(
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'CURRENT',
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}

/**
 * Create a freshness assessment for STALE information.
 */
export function createStaleAssessment(
  reasons: StalenessReason[],
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'STALE',
    reasons,
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}

/**
 * Create a freshness assessment for HISTORICAL information.
 */
export function createHistoricalAssessment(
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'HISTORICAL',
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}

/**
 * Create a freshness assessment for SUPERSEDED information.
 */
export function createSupersededAssessment(
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'SUPERSEDED',
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}

/**
 * Create a freshness assessment for UNKNOWN information.
 */
export function createUnknownAssessment(
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'UNKNOWN',
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}

/**
 * Create a freshness assessment for CONFLICTING information.
 */
export function createConflictingAssessment(
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'CONFLICTING',
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}

/**
 * Create a freshness assessment for VERIFIED information.
 */
export function createVerifiedAssessment(
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'VERIFIED',
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}

/**
 * Create a freshness assessment for EXPIRED information.
 */
export function createExpiredAssessment(
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'EXPIRED',
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}

/**
 * Create a freshness assessment for STORED information (baseline state).
 */
export function createStoredAssessment(
  evidence: FreshnessEvidence[],
  explanation: string,
  careContextVersion?: string
): FreshnessAssessment {
  return {
    state: 'STORED',
    evidence,
    explanation,
    assessedAt: new Date().toISOString(),
    careContextVersion
  };
}