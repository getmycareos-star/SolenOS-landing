import type { CareContext, PatternObservation } from "../types";
import { detectPatterns as detectEnhancedPatterns, EnhancedPattern } from "../../../lib/pattern-intelligence/pattern-detection-engine";

/**
 * Pattern Learning Engine — identifies recurring relationships in the care journey.
 * Explicitly avoids assumptions of causation. Patterns help recognize changes earlier.
 * This is the foundational pattern recognition system for SolenOS.
 */
export function detectPatterns(context: CareContext): PatternObservation[] {
  try {
    // Extract caregiver ID from context identity
    const caregiverId = context.identity?.caregiverId;
    
    // If we don't have a caregiver ID, fall back to basic pattern detection
    if (!caregiverId) {
      console.warn("No caregiver ID available in context, falling back to basic pattern detection");
      return basicPatternDetection(context);
    }
    
    // Detect enhanced patterns using our sophisticated system
    const enhancedResult = detectEnhancedPatterns(caregiverId);
    const enhancedPatterns = enhancedResult.patterns;
    
    // Convert EnhancedPattern to PatternObservation for backward compatibility
    const patternObservations: PatternObservation[] = enhancedPatterns.map(enhancedPattern => ({
      pattern: enhancedPattern.label,
      occurrences: enhancedPattern.occurrence_count,
      firstSeen: enhancedPattern.recurrence_characterities.first_occurrence || null,
      lastSeen: enhancedPattern.recurrence_characterities.last_occurrence || null,
      relatedEvents: enhancedPattern.supporting_evidence.map(ev => ev.description),
      disclaimer: "This pattern reflects repeated observations in your care timeline — not a medical cause or diagnosis."
    }));
    
    return patternObservations;
  } catch (error) {
    // Fallback to basic pattern detection if our advanced system fails
    console.warn("Advanced pattern detection failed, falling back to basic detection:", error);
    return basicPatternDetection(context);
  }
}

/**
 * Basic pattern detection fallback (original implementation)
 */
function basicPatternDetection(context: CareContext): PatternObservation[] {
  const patterns: PatternObservation[] = [];
  const disclaimer =
    "This pattern reflects repeated observations in your care timeline — not a medical cause or diagnosis.";

  const SYMPTOM_KEYWORDS = [
    "headache",
    "pain",
    "wander",
    "confusion",
    "appetite",
    "fall",
    "exhaust",
    "night",
  ] as const;

  for (const keyword of SYMPTOM_KEYWORDS) {
    const matching = context.timeline.filter((e) =>
      e.description.toLowerCase().includes(keyword),
    );

    if (matching.length >= 2) {
      const dates = matching
        .map((e) => e.date)
        .filter((d): d is string => d !== null)
        .sort();

      patterns.push({
        pattern: `Recurring "${keyword}" observations`,
        occurrences: matching.length,
        firstSeen: dates[0] ?? null,
        lastSeen: dates[dates.length - 1] ?? null,
        relatedEvents: matching.map((e) => e.description),
        disclaimer,
      });
    }
  }

  const nighttimeEvents = context.timeline.filter((e) =>
    /\b(night|overnight|evening|midnight)\b/i.test(e.description),
  );
  const daytimeEvents = context.timeline.filter(
    (e) =>
      !/\b(night|overnight|evening|midnight)\b/i.test(e.description) &&
      e.date !== null,
  );

  if (nighttimeEvents.length >= 2 && nighttimeEvents.length > daytimeEvents.length / 2) {
    patterns.push({
      pattern: "Events cluster in nighttime or evening hours",
      occurrences: nighttimeEvents.length,
      firstSeen: nighttimeEvents[0]?.date ?? null,
      lastSeen: nighttimeEvents[nighttimeEvents.length - 1]?.date ?? null,
      relatedEvents: nighttimeEvents.map((e) => e.description),
      disclaimer,
    });
  }

  return patterns;
}

/**
 * Get full enhanced patterns for systems that need detailed pattern data
 * This function provides access to the complete EnhancedPattern objects
 * for use by What Matters?, Weekly Review, Professional Follow-up, etc.
 */
export function getEnhancedPatternsForContext(context: CareContext): EnhancedPattern[] {
  try {
    const caregiverId = context.identity?.caregiverId;
    
    // If we don't have a caregiver ID, return empty array
    if (!caregiverId) {
      console.warn("No caregiver ID available in context, cannot get enhanced patterns");
      return [];
    }
    
    const result = detectEnhancedPatterns(caregiverId);
    return result.patterns;
  } catch (error) {
    console.warn("Failed to get enhanced patterns:", error);
    return [];
  }
}