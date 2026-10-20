/**
 * Causation Separation Guardrails for SolenOS Pattern Recognition
 * Implements strict separations between pattern detection (recurrence) 
 * and causation inference as required by points 13, 14, 37, and throughout
 * the specification to prevent implying causation from correlation.
 */

import type { EnhancedPattern } from "./pattern-models";
import type { JourneyGraphEvent } from "../care-journey-graph/types";

/**
 * Causation Separation Validation
 */
export type CausationSeparationCheck = {
  isSafe: boolean;
  violations: string[];
  warnings: string[];
  safeAlternativePhrasing: string[];
};

/**
 * Guardrails to ensure pattern detection never implies causation
 */
export class CausationSeparationGuardrails {
  /**
   * Validate that pattern language and implications maintain 
   * strict separation between pattern and causation
   */
  public static validatePatternLanguage(
    pattern: EnhancedPattern
  ): CausationSeparationCheck {
    const violations: string[] = [];
    const warnings: string[] = [];
    const safeAlternativePhrasing: string[] = [];
    
    // Check 1: Ensure causation status is explicitly "not established"
    if (pattern.causation_status !== "not established") {
      violations.push(
        `Causation status must be "not established" but is "${pattern.causation_status}". ` +
        "Patterns describe recurrence only, not causation."
      );
      safeAlternativePhrasing.push(
        `Change causation status to "not established" to maintain proper separation.`
      );
    }
    
    // Check 2: Review uncertainty description for causal language
    const uncertaintyViolations = this.checkForCausalLanguage(
      pattern.uncertainty,
      "uncertainty description"
    );
    violations.push(...uncertaintyViolations.violations);
    warnings.push(...uncertaintyViolations.warnings);
    safeAlternativePhrasing.push(...uncertaintyViolations.safeAlternatives);
    
    // Check 3: Review description for causal implications
    const descriptionViolations = this.checkForCausalLanguage(
      pattern.description,
      "pattern description"
    );
    violations.push(...descriptionViolations.violations);
    warnings.push(...descriptionViolations.warnings);
    safeAlternativePhrasing.push(...descriptionViolations.safeAlternatives);
    
    // Check 4: Review label for causal implications
    const labelViolations = this.checkForCausalLanguage(
      pattern.label,
      "pattern label"
    );
    violations.push(...labelViolations.violations);
    warnings.push(...labelViolations.warnings);
    safeAlternativePhrasing.push(...labelViolations.safeAlternatives);
    
    // Check 5: Review alternative interpretations for causal language
    for (const alt of pattern.alternative_interpretations) {
      const altViolations = this.checkForCausalLanguage(
        alt.description,
        `alternative interpretation: "${alt.description.substring(0, 50)}..."`
      );
      violations.push(...altViolations.violations);
      warnings.push(...altViolations.warnings);
      safeAlternativePhrasing.push(...altViolations.safeAlternatives);
    }
    
    // Check 6: Ensure verification status doesn't imply causation
    // Verification is about pattern acceptance, not causation truth
    // This is more about ensuring the concept is understood correctly
    
    // Check 7: Review any user-added context or corrections for causal language
    // This would be checked during user verification processing
    
    const isSafe = violations.length === 0;
    
    return {
      isSafe,
      violations,
      warnings,
      safeAlternativePhrasing: [...new Set(safeAlternativePhrasing)] // Remove duplicates
    };
  }

  /**
   * Check text for causal language that implies causation from pattern
   */
  private static checkForCausalLanguage(
    text: string,
    context: string
  ): {
    violations: string[];
    warnings: string[];
    safeAlternatives: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];
    const safeAlternatives: string[] = [];
    
    if (!text || typeof text !== "string") {
      return { violations, warnings, safeAlternatives };
    }
    
    const lowerText = text.toLowerCase();
    
    // Direct causal language violations (always forbidden)
    const directCausalPatterns = [
      { pattern: /\bcaused?\s+by\b/, suggestion: "associated with" },
      { pattern: /\bcauses?\b/, suggestion: "is associated with" },
      { pattern: /\bdue\s+to\b/, suggestion: "possibly related to" },
      { pattern: /\bleads?\s+to\b/, suggestion: "may be followed by" },
      { pattern: /\brings?\s+about\b/, suggestion: "may co-occur with" },
      { pattern: /\bresults?\s+in\b/, suggestion: "is sometimes followed by" },
      { pattern: /\btrigger?s?\b/, suggestion: "may coincide with" },
      { pattern: /\binfluences?\b/, suggestion: "may be related to" },
      { pattern: /\baffects?\b/, suggestion: "may be associated with" },
      { pattern: /\binduces?\b/, suggestion: "may be seen with" },
      { pattern: /\bproduces?\b/, suggestion: "may be accompanied by" },
      { pattern: /\bresponsible\s+for\b/, suggestion: "associated with" },
      { pattern: /\bbecause\s+of\b/, suggestion: "possibly related to" }
    ];
    
    for (const { pattern, suggestion } of directCausalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push(
          `Direct causal language detected in ${context}: "${matches[0]}" ` +
          `suggests causation. Patterns describe recurrence only.`
        );
        safeAlternatives.push(
          `Consider replacing "${matches[0]}" with "${suggestion}" to maintain proper separation.`
        );
      }
    }
    
    // Implied causal language warnings (context dependent)
    const impliedCausalPatterns = [
      { pattern: /\bexplanation\s+for\b/, context: "may imply causation" },
      { pattern: /\breason\s+for\b/, context: "may imply causation" },
      { pattern: /\bfactor\s+in\b/, context: "may imply causation" },
      { pattern: /\bcontributes?\s+to\b/, context: "may imply causation" },
      { pattern: /\bplays?\s+a\s+role\s+in\b/, context: "may imply causation" },
      { pattern: /\bis\s+linked\s+to\b/, context: "association acceptable but verify intent" },
      { pattern: /\bconnection\s+between\b/, context: "association acceptable but verify intent" }
    ];
    
    for (const { pattern, contextWarning } of impliedCausalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        warnings.push(
          `Language in ${context}: "${matches[0]}" ${contextWarning}. ` +
          `Ensure this describes association only, not causation.`
        );
        safeAlternatives.push(
          `Consider rephrasing to explicitly state this is an observed association only.`
        );
      }
    }
    
    // Statistical language that might imply causation
    const statisticalPatterns = [
      { pattern: /\bcorrelation\s+implies\b/, suggestion: "correlation does not imply causation" },
      { pattern: /\bstatistically\s+significant\s+.*\bcause\b/, suggestion: "statistical association found" },
      { pattern: /\bprobability\s+of\s+causation\b/, suggestion: "probability of association" }
    ];
    
    for (const { pattern, suggestion } of statisticalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push(
          `Statistical language implying causation detected in ${context}: "${matches[0]}" `
        );
        safeAlternatives.push(
          `Consider replacing with "${suggestion}" to maintain proper epistemological stance.`
        );
      }
    }
    
    // Check for predictive language that might imply causation
    const predictivePatterns = [
      { pattern: /\bwill\s+lead\s+to\b/, suggestion: "may be followed by" },
      { pattern: /\bexpect\s+to\s+see\b/, suggestion: "may observe" },
      { pattern: /\bpredicts?\b/, suggestion: "suggests possible association with" },
      { pattern: /\bforecasts?\b/, suggestion: "suggests possible association with" }
    ];
    
    for (const { pattern, suggestion } of predictivePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        warnings.push(
          `Predictive language in ${context}: "${matches[0]}" may imply causal expectation. `
        );
        safeAlternatives.push(
          `Consider replacing with "${suggestion}" to maintain focus on observed patterns only.`
        );
      }
    }
    
    return {
      violations,
      warnings,
      safeAlternatives
    };
  }

  /**
   * Validate that pattern presentation layer maintains separation
   */
  public static validatePatternPresentation(
    patternData: {
      label: string;
      description: string;
      whatWeKnow: string;
      whatWeDontKnow: string;
      causationStatement: string;
      evidenceSummary: string;
    }
  ): CausationSeparationCheck {
    const violations: string[] = [];
    const warnings: string[] = [];
    const safeAlternativePhrasing: string[] = [];
    
    // Check each field
    const labelCheck = this.checkForCausalLanguage(
      patternData.label,
      "pattern label"
    );
    violations.push(...labelCheck.violations);
    warnings.push(...labelCheck.warnings);
    safeAlternativePhrasing.push(...labelCheck.safeAlternatives);
    
    const descriptionCheck = this.checkForCausalLanguage(
      patternData.description,
      "pattern description"
    );
    violations.push(...descriptionCheck.violations);
    warnings.push(...descriptionCheck.warnings);
    safeAlternativePhrasing.push(...descriptionCheck.safeAlternatives);
    
    const whatWeKnowCheck = this.checkForCausalLanguage(
      patternData.whatWeKnow,
      "what we know section"
    );
    violations.push(...whatWeKnowCheck.violations);
    warnings.push(...whatWeKnowCheck.warnings);
    safeAlternativePhrasing.push(...whatWeKnowCheck.safeAlternatives);
    
    const whatWeDontKnowCheck = this.checkForCausalLanguage(
      patternData.whatWeDontKnow,
      "what we don't know section"
    );
    violations.push(...whatWeDontKnowCheck.violations);
    warnings.push(...whatWeDontKnowCheck.warnings);
    safeAlternativePhrasing.push(...whatWeDontKnowCheck.safeAlternatives);
    
    // Special check: causation statement must be explicit
    const causationLower = patternData.causationStatement.toLowerCase();
    if (!causationLower.includes("not established") && 
        !causationLower.includes("not been established") &&
        !causationLower.includes("unknown")) {
      violations.push(
        "Causation statement must explicitly state that causation has not been established. " +
        "Current statement: " + patternData.causationStatement
      );
      safeAlternativePhrasing.push(
        'Use clear language such as "The cause is not established" or "Causation unknown"' +
        " to maintain proper separation."
      );
    }
    
    const isSafe = violations.length === 0;
    
    return {
      isSafe,
      violations,
      warnings,
      safeAlternativePhrasing: [...new Set(safeAlternativePhrasing)]
    };
  }

  /**
   * Generate safe language patterns for common pattern descriptions
   */
  public static generateSafePatternLanguage(
    patternType: string,
    observationCount: number,
    timePeriod: string
  ): {
    label: string;
    description: string;
    whatWeKnow: string;
    whatWeDontKnow: string;
    causationStatement: string;
  } {
    return {
      label: `${observationCount} ${patternType} observations over ${timePeriod}`,
      description: `Recurring pattern detected in ${observationCount} observations. ` +
                  `First observed: [date], Most recent: [date]. ` +
                  `This pattern describes observed recurrence only - the underlying cause is not established.`,
      whatWeKnow: `We have observed ${observationCount} instances of similar observations ` +
                 `over the period ${timePeriod}. These observations share sufficient similarities ` +
                 `to be considered a recurring pattern.`,
      whatWeDontKnow: `The underlying cause of this pattern is not established. ` +
                     `We do not know why these observations recur or what factors ` +
                     `may be influencing their pattern.`,
      causationStatement: "Cause: Not established. This pattern describes observed recurrence only."
    };
  }

  /**
   * Validate that a pattern does not imply causation through any means
   * This is a comprehensive check to be run before pattern presentation
   */
  public static assertNoCausationImplication(
    pattern: EnhancedPattern
  ): void {
    const check = this.validatePatternLanguage(pattern);
    
    if (!check.isSafe) {
      const errorMessage = [
        "Causation separation violation detected in pattern.",
        "Violations:",
        ...check.violations.map((v, i) => `${i + 1}. ${v}`),
        "",
        "Suggested corrections:",
        ...check.safeAlternativePhrasing.map((s, i) => `${i + 1}. {s}`),
        "",
        "Pattern ID: " + pattern.identity.id,
        "Pattern Label: " + pattern.label
      ].join("\n");
      
      // In a production system, this might log or throw
      // For now, we'll console.error but in reality this should prevent pattern presentation
      console.error(errorMessage);
      
      // Depending on system configuration, we might either:
      // 1. Throw error to prevent unsafe pattern presentation
      // 2. Auto-correct the pattern (not recommended as it overrides intended meaning)
      // 3. Flag for review before presentation
      
      // For safety in this implementation, we'll throw to prevent unsafe patterns
      throw new Error(`Causation separation violation: ${check.violations[0]}`);
    }
    
    // Log warnings but don't prevent presentation
    if (check.warnings.length > 0) {
      console.warn(`Causation separation warnings for pattern ${pattern.identity.id}:`, check.warnings);
    }
  }
}

/**
 * Utility functions for ensuring causation separation in pattern processing
 */

/**
 * Sanitize pattern text to remove causal implications
 * (Useful for preprocessing or fallback)
 */
export function sanitizePatternLanguage(text: string): string {
  if (!text || typeof text !== "string") return text;
  
  let sanitized = text;
  
  // Replace direct causal language with safer alternatives
  const replacements: [RegExp, string][] = [
    [/\bcaused?\s+by\b/gi, "associated with"],
    [/\bcauses?\b/gi, "is associated with"],
    [/\bdue\s+to\b/gi, "possibly related to"],
    [/\bleads?\s+to\b/gi, "may be followed by"],
    [/\brings?\s+about\b/gi, "may co-occur with"],
    [/\bresults?\s+in\b/gi, "is sometimes followed by"],
    [/\btrigger?s?\b/gi, "may coincide with"],
    [/\binfluences?\b/gi, "may be related to"],
    [/\baffects?\b/gi, "may be associated with"],
    [/\binduces?\b/gi, "may be seen with"],
    [/\bproduces?\b/gi, "may be accompanied by"],
    [/\bresponsible\s+for\b/gi, "associated with"],
    [/\bbeause\s+of\b/gi, "possibly related to"] // Catch common typo
  ];
  
  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  return sanitized;
}

/**
 * Create a causation-safe pattern description from components
 */
export function createSafePatternDescription(
  observationCount: number,
  firstDate: string,
  lastDate: string,
  patternType: string = "observations"
): string {
  return `Recurring pattern detected in ${observationCount} ${patternType}. ` +
         `First observed: ${firstDate}, Most recent: ${lastDate}. ` +
         `This pattern describes observed recurrence only - the underlying cause is not established.`;
}

/**
 * Create a causation-safe uncertainty statement
 */
export function createSafeUncertaintyStatement(
  knownFactors: string[] = [],
  unknownFactors: string[] = []
): string {
  const knownPart = knownFactors.length > 0 
    ? `We know that ${knownFactors.join(", ")}. ` 
    : "";
  
  const unknownPart = unknownFactors.length > 0
    ? `We do not know: ${unknownFactors.join(", ")}. `
    : "We do not know the underlying factors influencing this pattern. ";
  
  const causationPart = "Importantly, we do not know whether any observed associations " +
                       "represent causal relationships. This pattern describes recurrence only.";
  
  return knownPart + unknownPart + causationPart;
}