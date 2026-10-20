import { OpenLoopService } from '../open-loop-service'
import { Pool } from 'pg'

/**
 * Specialized detector for conflicting information (Directive #13)
 * 
 * Identifies meaningful contradictions across the longitudinal record.
 * Examples:
 *   - medication dose A vs dose B
 *   - appointment date A vs date B
 *   - diagnosis documented differently across sources
 *   - caregiver reports medication stopped while another recent record lists it active
 *   - two sources provide incompatible outcomes
 * 
 * Per Directive #13: A contradiction should not be silently resolved by the AI.
 * Represent:
 *   conflict
 *   source A
 *   source B
 *   what differs
 *   dates/timestamps
 *   confidence/source authority
 *   current status
 *   required resolution
 * The contradiction itself can become an Open Loop.
 */
export class ConflictingInformationDetector {
  constructor(private openLoopService: OpenLoopService) {}

  /**
   * Detect conflicting information in text with contextual awareness
   * 
   * @param text The text to analyze (appointment note, conversation, etc.)
   * @param context Contextual information for filtering relevance
   * @returns Detected conflicting information with evidence and confidence
   */
  async detect(
    text: string,
    context: {
      caregiverId: string;
      careRecipientId: string;
      sourceEventId?: string;
      source?: string;
      careContext?: any; // Would be care context in full implementation
    }
  ): Promise<Array<{
    loop: {
      id: string;
      category: 'conflicting_information';
      description: string;
      created_at: string;
      updated_at: string;
      status: 'open' | 'reconnected';
      priority: number;
      caregiver_id: string;
      care_recipient_id: string;
      source_event_id: string | null;
      resolved_by_event_id: string | null;
      resolution: string | null;
      tags: string[];
      source: string;
      provenance: any;
    };
    evidence: string;
    confidence: number;
    isMaterial: boolean; // Whether this conflicting information is material to care continuity
  }>> {
    // First use the general text detection from OpenLoopService
    const candidates = await this.openLoopService.detectFromText(text, {
      caregiverId: context.caregiverId,
      careRecipientId: context.careRecipientId,
      sourceEventId: context.sourceEventId,
      source: context.source
    });

    // Filter to only conflicting_information category
    const conflictCandidates = candidates.filter(
      candidate => candidate.loop.category === 'conflicting_information'
    );

    // Apply materiality filtering (Directive #13)
    const materialConflicts = await Promise.all(
      conflictCandidates.map(async candidate => {
        const isMaterial = await this.assessMateriality(
          candidate.loop.description,
          candidate.evidence,
          context
        );

        return {
          ...candidate,
          isMaterial
        };
      })
    );

    // Return only material conflicting information
    return materialConflicts.filter(c => c.isMaterial);
  }

  /**
   * Assess whether conflicting information is material to care continuity (Directive #13)
   * 
   * @param conflictText The conflicting information text
   * @param evidence The evidence context where the conflicting information was found
   * @param context Additional context
   * @returns Whether the conflicting information is material to care continuity
   */
  private async assessMateriality(
    conflictText: string,
    evidence: string,
    context: {
      careContext?: any;
      caregiverId: string;
      careRecipientId: string;
    }
  ): Promise<boolean> {
    // Materiality criteria from Directive #13:
    // The conflicting information must be relevant to the care record or an unresolved care state

    // Check if conflict relates to known care domains
    const careDomainIndicators = [
      // Medical domains
      /\\b(medication|medicine|drug|prescription|dose|dosage|side effect|allergy)\\b/i,
      // Appointment domains
      /\\b(appointment|visit|follow.?up|check.?up|referral|specialist|doctor|physician)\\b/i,
      // Test domains
      /\\b(test|lab|blood|x-ray|mri|ct scan|biopsy|screening)\\b/i,
      // Symptom domains
      /\\b(symptom|pain|discomfort|feeling|state|condition)\\b/i,
      // Care domains
      /\\b(care|treatment|therapy|procedure|intervention|help|support)\\b/i,
      // Logistics domains
      /\\b(schedule|time|date|location|transportation|insurance|cost)\\b/i
    ];

    const combinedText = (conflictText + ' ' + evidence).toLowerCase();
    const relatesToCareDomain = careDomainIndicators.some(regex => regex.test(combinedText));

    // Check if conflict relates to unresolved states
    const unresolvedStateIndicators = [
      /\\b(unsure|uncertain|don\\''t know|not sure|unclear)\\b/i,
      /\\b(need to know|require information|question about|wondering)\\b/i,
      /\\b(what if|how will|when will|where is|who\\s+will)/i,
      /\\b(status|result|outcome|response|answer)\\b.*\\b(pending|unknown|awaiting|expected)\\b/i,
      // Conflicting information-specific unresolved states (Directive #13)
      /\\b(conflict|contradiction|disagreement|discrepancy|variance|difference|inconsistency|mismatch).*\\b(between|among|vs|versus|and)\\b/i,
      /\\b(between|among|vs|versus|and).*\\b(conflict|contradiction|disagreement|discrepancy|variance|difference|inconsistency|mismatch)\\b/i,
      /\\b(source|report|record|mention|say|document|evidence).*\\b(disagree|conflict|contradict|differ|vari| mismatch).*\\b(another|other|different|second)\\b/i,
      /\\b(another|other|different|second).*\\b(source|report|record|mention|say|document|evidence).*\\b(disagree|conflict|contradict|differ|vari| mismatch)\\b/i,
      /\\b(different|conflicting|contradicting).*\\b(diagnosis|symptom|finding|result|value|reading|level|dose|date|time)\\b/i,
      /\\b(diagnosis|symptom|finding|result|value|reading|level|dose|date|time).*\\b(different|conflicting|contradicting)\\b/i
    ];

    const relatesToUncertainty = unresolvedStateIndicators.some(regex => regex.test(combinedText));

    // Check for care context relevance (if available)
    // In full implementation, would check against care context for:
    // - Current medications
    // - Upcoming appointments
    // - Recent tests
    // - Known conditions
    // etc.

    // For now, use basic heuristics
    const isMaterial = relatesToCareDomain || relatesToUncertainty;

    // Additional filtering: exclude casual/social mentions
    const casualPatterns = [
      /\\b(how are you|how\\''s it going|nice weather|how\\''s family)\\b/i,
      /\\b(thanks|thank you|appreciate|grateful)\\b/i,
      /\\b(goodbye|bye|see you|talk later)\\b/i
    ];

    const isCasual = casualPatterns.some(regex => regex.test(conflictText));

    return isMaterial && !isCasual;
  }

  /**
   * Get specific evidence-based follow-up suggestions for this conflicting information type
   * Per Directive #19: Expected follow-up should be evidence-based, not invented
   */
  async getFollowUpSuggestions(
    conflictText: string,
    evidence: string
  ): Promise<Array<{
    type: 'explicit-date' | 'explicit-timeframe' | 'event-relative' | 'recommended' | 'unknown';
    description: string;
    confidence: number;
    basis: string; // Evidence supporting this follow-up
  }>> {
    const suggestions: Array<{
      type: 'explicit-date' | 'explicit-timeframe' | 'event-relative' | 'recommended' | 'unknown';
      description: string;
      confidence: number;
      basis: string;
    }> = [];

    const combined = (conflictText + ' ' + evidence).toLowerCase();

    // Explicit date patterns
    const datePatterns = [
      { regex: /\\b(january|february|march|april|may|june|july|august|september|october|november|december)\\s+\\d{1,2},?\\s+\\d{4}\\b/i, type: 'explicit-date' },
      { regex: /\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b/i, type: 'explicit-date' },
      { regex: /\\b\\d{4}-\\d{2}-\\d{2}\\b/i, type: 'explicit-date' }
    ];

    for (const pattern of datePatterns) {
      const match = combined.match(pattern.regex);
      if (match) {
        suggestions.push({
          type: 'explicit-date',
          description: match[0],
          confidence: 0.9,
          basis: `Found explicit date: ${match[0]}`
        });
      }
    }

    // Explicit timeframe patterns
    const timeframePatterns = [
      { regex: /\\b(in|within)\\s+(\\d+)\\s+(days?|weeks?|months?)\\b/i, type: 'explicit-timeframe' },
      { regex: /\\b(every)\\s+(\\d+)\\s+(days?|weeks?|months?)\\b/i, type: 'explicit-timeframe' },
      { regex: /\\b(next)\\s+(day|week|month)\\b/i, type: 'explicit-timeframe' }
    ];

    for (const pattern of timeframePatterns) {
      const match = combined.match(pattern.regex);
      if (match) {
        suggestions.push({
          type: 'explicit-timeframe',
          description: match[0],
          confidence: 0.85,
          basis: `Found explicit timeframe: ${match[0]}`
        );
      }
    }

    // Event-relative patterns
    const eventRelativePatterns = [
      { regex: /\\b(after|following|once)\\s+(the|this)\\s+(appointment|visit|test|procedure|treatment)\\b/i, type: 'event-relative' },
      { regex: /\\b(when)\\s+(we|i)\\s+(get|receive|have)\\s+.*\\b(results|answer|feedback)\\g/i, type: 'event-relative' },
      { regex: /\\b(upon)\\s+(completion|receipt)\\s+of\\b/i, type: 'event-relative' }
    ];

    for (const pattern of eventRelativePatterns) {
      const match = combined.match(pattern.regex);
      if (match) {
        suggestions.push({
          type: 'event-relative',
          description: match[0],
          confidence: 0.8,
          basis: `Found event-relative timing: ${match[0]}`
        );
      }
    }

    // Recommended patterns (Directive #19: Never convert recommendation into hard deadline)
    const recommendedPatterns = [
      { regex: /\\b(consider|think about|might want to|should probably)\\s+(ask|call|check|follow up)\\b/i, type: 'recommended' },
      { regex: /\\b(it would be|it\\''s a good idea to|perhaps)\\s+(check|verify|confirm)\\b/i, type: 'recommended' }
    ];

    for (const pattern of recommendedPatterns) {
      if (match) {
        suggestions.push({
          type: 'recommended',
          description: match[0],
          confidence: 0.7,
          basis: `Found recommended follow-up: ${match[0]} (not a hard deadline per Directive #19)`
        );
      }
    }

    // If no specific patterns found, default to unknown with low confidence
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'unknown',
        description: 'No specific follow-up indicated in evidence',
        confidence: 0.3,
        basis: 'No explicit date, timeframe, event-relative, or recommended follow-up found in evidence'
      });
    }

    return suggestions;
  }
}

