// Test the newly created pipeline.ts
const fs = require('fs');

// Write the file using Node.js (to avoid corruption)
fs.writeFileSync('./src/lib/situation-entry/pipeline.ts', `
// Situation Entry Pipeline - Core processing function for care situations
// This is a simplified but functional implementation based on the forensic report requirements

import { FreshnessEvaluationManager } from '../freshness-evaluation';
import { MedicationFreshnessEvaluator } from '../freshness-evaluation/medication-evaluator';
import { CanonicalCareEvent } from './types';
import { CareContextRoot } from './types';
import { SituationResponse } from './types';
import { CareStateChangeReport, DomainChange, ChangeClassification, CareDomain, CompoundSignal } from '../care-state-change-detector/types';
import { parseSituationToCareEvent } from './parse-situation';
import { getOrCreateCareContextRoot, appendEventsToContext } from './context-store';
import { composeCaregiverResponse } from '../caregiver-response-composer';

// Initialize the freshness evaluation manager and register evaluators
const freshnessManager = new FreshnessEvaluationManager();
freshnessManager.registerEvaluator('medication', new MedicationFreshnessEvaluator());
// TODO: Register other evaluators as they are created
// freshnessManager.registerEvaluator('routine', new RoutineFreshnessEvaluator());
// freshnessManager.registerEvaluator('appointment', new AppointmentFreshnessEvaluator());

/**
 * Process a care situation input through the full pipeline
 * @param input - The situation input to process
 * @returns A promise resolving to the situation response
 */
export async function processSituationInput(input: {
  raw_input: string;
  caregiver_id?: string;
  care_recipient_id?: string;
  care_session_id?: string;
  timestamp?: string;
  source?: 'user_input' | 'document';
}): Promise<SituationResponse> {
  // Generate timestamps
  const timestamp = input.timestamp ?? new Date().toISOString();
  
  // Parse the situation into a care event
  const careEvent = await parseSituationToCareEvent({
    raw_input: input.raw_input,
    source: input.source ?? 'user_input',
    ingestion_time: timestamp,
    // Generate a proper ID (simplified)
    id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
  });
  
  // Get or create care context root
  const careContextRoot = await getOrCreateCareContextRoot({
    care_recipient_id: input.care_recipient_id ?? input.caregiver_id ?? 'unknown',
    caregiver_id: input.caregiver_id ?? 'unknown',
  });
  
  // Append event to context
  const updatedContext = await appendEventsToContext(careContextRoot, [careEvent]);
  
  // Detect care state changes based on the input
  const stateChangeReport = detectCareStateChanges(input.raw_input, timestamp);
  
  // Compose caregiver response
  const composedResponse = composeCaregiverResponse({
    // We'll need to pass the state change report and other required parameters
    // For now, we'll create a minimal structure
    situation_id: careEvent.situation_id ?? 'unknown-situation',
    care_state_change_report: stateChangeReport,
    events_created: [careEvent],
    context: updatedContext,
    raw_input: input.raw_input,
    caregiver_id: input.caregiver_id ?? 'unknown',
  });
  
  // Build and return the situation response
  return {
    // Basic response fields from SituationResponse type
    what_i_understood: [],
    what_is_uncertain: [],
    what_needs_clarification: [],
    what_will_be_tracked: [],
    what_changed: [],
    what_merged_or_split: [],
    events_created: [careEvent],
    context: updatedContext,
    is_first_situation: false, // Simplified - would need to check if this is the first situation for this care recipient
    document_events_count: 0,
    dare: null,
    timeline_views: null,
    integrity_summary: null,
    priority_layer: null,
    memory_layer: null,
    failure_resilience_layer: null,
    trust_provenance_layer: null,
    network_effect_moat_layer: null,
    success_model_layer: null,
    clarification_engine_layer: null,
    memory_strategy_layer: null,
    trust_layer_engine_layer: null,
    crisis_mode_interaction_layer: null,
    multi_caregiver_context_layer: null,
    audit_trail_layer: null,
    state_of_care_summary_layer: null,
    care_context_diff_layer: null,
    entry_behavior_layer: null,
    care_timeline_engine_layer: null,
    task_extraction_layer: null,
    current_state_view_layer: null,
    adoption_wedge_layer: null,
    product_reality_model_layer: null,
    forbidden_build_zone_layer: null,
    policy_engine_layer: null,
    timeline_reconstruction_layer: null,
    contradiction_detection_layer: null,
    care_transparency_layer: null,
    baseline_intelligence_layer: null,
    care_state_change_report: stateChangeReport,
    input_relevance_layer: null,
    care_reality_profile_layer: null,
    moment_of_need_layer: null,
    retention_engine_layer: null,
    priority_resolution_layer: null,
    edge_state_layer: null,
    event_sourced_storage_layer: null,
    engine_execution_contract_layer: null,
    confidence_calibration_layer: null,
    care_state_engine_layer: null,
    single_user_journey_layer: null,
    product_north_star_layer: null,
    product_constitution_layer: null,
    continuity_properties_layer: null,
    care_reality_intelligence_layer: null,
    care_reality_engine_layer: null,
    care_signal_understanding_layer: null,
    generalized_care_understanding_layer: null,
    cross_domain_reasoning_layer: null,
    care_identity_summary: null,
    continuity_decision: null,
    composed: composedResponse,
  };
}

/**
 * Detect care state changes from raw input text
 * Implements signal-based detection for MVP
 */
function detectCareStateChanges(rawInput: string, timestamp: string): CareStateChangeReport {
  const lowerInput = rawInput.toLowerCase();
  
  // Define signal patterns for different domains and change types
  const moodPatterns = {
    worsening: /\b(agitat(?:ed|ion)?|angry|upset|frustrated|irritable|anxious)\b/i,
    improvement: /\b(calm|happy|content|peaceful|relaxed)\b/i,
    neutral: /\b(cooperative|calm|okay|fine)\b/i
  };
  
  const appetitePatterns = {
    worsening: /\b(refus(?:ed|es)?|not eating|decreased appetite|poor appetite)\b/i,
    improvement: /\b(ate|eating|appetite|hungry|meal|breakfast|lunch|dinner)\b/i,
    neutral: /\b(normal eating|regular appetite)\b/i
  };
  
  const sleepPatterns = {
    worsening: /\b(up all night|insomnia|not sleeping|sleep deprived|restless)\b/i,
    improvement: /\b(sleeping|slept|rest|asleep|good sleep)\b/i,
    neutral: /\b(sleeping through night|normal sleep)\b/i
  };
  
  const mobilityPatterns = {
    worsening: /\b(fell|fall|unsteady|balance|weak|difficulty walking)\b/i,
    improvement: /\b(walking|mobile|steady|strong|improved mobility)\b/i,
    neutral: /\b(steady on feet|stable|normal mobility)\b/i
  };
  
  // Determine what changed based on patterns
  const changes: DomainChange[] = [];
  
  // Check mood
  if (moodPatterns.worsening.test(lowerInput)) {
    changes.push({
      domain: 'mood',
      classification: 'WORSENED' as ChangeClassification,
      confidence: 'medium',
      prior_state: 'calm',
      current_state: 'agitated',
      evidence: [rawInput],
      trajectory: 'worsening',
      first_observed_at: null,
      last_observed_at: timestamp,
      observation_count: 1
    });
  } else if (moodPatterns.improvement.test(lowerInput)) {
    changes.push({
      domain: 'mood',
      classification: 'IMPROVED' as ChangeClassification,
      confidence: 'medium',
      prior_state: 'upset',
      current_state: 'calm',
      evidence: [rawInput],
      trajectory: 'improving',
      first_observed_at: null,
      last_observed_at: timestamp,
      observation_count: 1
    });
  }
  
  // Check appetite
  if (appetitePatterns.worsening.test(lowerInput)) {
    changes.push({
      domain: 'appetite',
      classification: 'WORSENED' as ChangeClassification,
      confidence: 'medium',
      prior_state: 'normal eating',
      current_state: 'refused food',
      evidence: [rawInput],
      trajectory: 'worsing',
      first_observed_at: null,
      last_observed_at: timestamp,
      observation_count: 1
    });
  } else if (appetitePatterns.improvement.test(lowerInput)) {
    changes.push({
      domain: 'appetite',
      classification: 'IMPROVED' as ChangeClassification,
      confidence: 'medium',
      prior_state: 'poor appetite',
      current_state: 'ate well',
      evidence: [rawInput],
      trajectory: 'improving',
      first_observed_at: null,
      last_observed_at: timestamp,
      observation_count: 1
    });
  }
  
  // Check sleep
  if (sleepPatterns.worsening.test(lowerInput)) {
    changes.push({
      domain: 'sleep',
      classification: 'WORSENED' as ChangeClassification,
      confidence: 'medium',
      prior_state: 'sleeping well',
      current_state: 'up all night',
      evidence: [rawInput],
      trajectory: 'worsing',
      first_observed_at: null,
      last_observed_at: timestamp,
      observation_count: 1
    });
  } else if (sleepPatterns.improvement.test(lowerInput)) {
    changes.push({
      domain: 'sleep',
      classification: 'IMPROVED' as ChangeClassification,
      confidence: 'medium',
      prior_state: 'insomnia',
      current_state: 'sleeping through night',
      evidence: [rawInput],
      trajectory: 'improving',
      first_observed_at: null,
      last_observed_at: timestamp,
      observation_count: 1
    });
  }
  
  // Check mobility
  if (mobilityPatterns.worsening.test(lowerInput)) {
    pushes.push({
      domain: 'mobility',
      classification: 'WORSENED' as ChangeClassification,
      confidence: 'medium',
      prior_state: 'steady on feet',
      current_state: 'fell',
      evidence: [rawInput],
      trajectory: 'worsing',
      first_observed_at: null,
      last_observed_at: timestamp,
      observation_count: 1
    });
  } else if (mobilityPatterns.improvement.test(lowerInput)) {
    changes.push({
      domain: 'mobility',
      classification: 'IMPROVED' as ChangeClassification,
      confidence: 'medium',
      prior_state: 'unsteady',
      current_state: 'walking',
      evidence: [rawInput],
      trajectory: 'improving',
      first_observed_at: null,
      last_observed_at: timestamp,
      observation_count: 1
    });
  }
  
  // If no specific changes detected, add a NEW observation for the primary domain mentioned
  if (changes.length === 0) {
    // Try to detect which domain is being discussed
    const domain = detectDomain(lowerInput);
    if (domain !== 'unknown') {
      changes.push({
        domain: domain,
        classification: 'NEW' as ChangeClassification,
        confidence: 'low',
        prior_state: null,
        current_state: 'observed state',
        evidence: [rawInput],
        trajectory: 'unknown',
        first_observed_at: null,
        last_observed_at: timestamp,
        observation_count: 1
      });
    }
  }
  
  // Create compound signals (simplified)
  const compoundSignals: CompoundSignal[] = [];
  if (changes.length > 1) {
    compoundSignals.push({
      domains: changes.map(c => c.domain),
      description: 'Multiple domain changes detected',
      attention_required: changes.some(c => 
        c.classification === 'WORSENED' || 
        c.classification === 'IMPROVED'
      )
    });
  }
  
  // Determine if attention is required
  const attentionRequired = changes.some(c => 
    c.classification === 'WORSENED' || 
    c.classification === 'IMPROVED' ||
    c.classification === 'NEW'
  );
  
  // Generate trajectory summary
  const trajectorySummary = generateTrajectorySummary(changes);
  
  return {
    generated_at: timestamp,
    has_meaningful_change: changes.length > 0,
    primary_changes: changes.filter(c => 
      c.classification === 'WORSENED' || 
      c.classification === 'IMPROVED' ||
      c.classification === 'NEW'
    ),
    all_changes: changes,
    compound_signals: compoundSignals,
    attention_required: attentionRequired,
    can_wait: !attentionRequired,
    unresolved_questions: [],
    trajectory_summary: trajectorySummary
  };
}

/**
 * Detect which domain is being discussed in the input
 */
function detectDomain(input: string): CareDomain {
  const domainPatterns: Record<CareDomain, RegExp> = {
    sleep: /\b(sleep|nap|night|insomnia|restless|awake|tired|exhausted)\b/i,
    appetite: /\b(appetite|eat(?:ing|s)?|meal|breakfast|lunch|dinner|refus(?:ed|es)?|hungry)\b/i,
    mobility: /\b(walk(?:ing|s)?|mobility|fall|unsteady|wheelchair|transfer|balance|fell)\b/i,
    mood: /\b(upset|agitat(?:ed|ion)?|anxious|calm|mood|irritable|happy|sad|frustrated|angry)\b/i,
    medication_adherence: /\b(medication|med|pill|dose|refus(?:ed|es)?|took|taken|missed|forgot|adherence)\b/i,
    communication: /\b(ask(?:ing|s)?|repeat(?:ing|s)?|question|talk|conversation|confus(?:ed|ion)?|word|name)\b/i,
    cognition: /\b(confus(?:ed|ion)?|memory|remember|forget|recognize|disorient(?:ed)?|dementia|alzheimer)\b/i,
    social: /\b(visit|visitor|family|friend|lonely|withdrawn|social|alone|isolated)\b/i,
    routine: /\b(routine|morning|evening|daily|habit|usually|normally|schedule)\b/i,
    safety: /\b(safe|unsafe|danger|wander|chok|dehydrat|infection|urgent|emergency|hospital)\b/i,
    unknown: /.*/
  };
  
  for (const [domain, pattern] of Object.entries(domainPatterns)) {
    if (pattern.test(input)) {
      return domain as CareDomain;
    }
  }
  
  return 'unknown';
}

/**
 * Generate a trajectory summary from the detected changes
 */
function generateTrajectorySummary(changes: DomainChange[]): string {
  const worsening = changes.filter(c => c.classification === 'WORSENED').length;
  const improving = changes.filter(c => c.classification === 'IMPROVED').length;
  
  if (worsening > 0 && improving > 0) {
    return \${worsening} area(s) showing concerning signals, \${improving} area(s) showing improvement\;
  } else if (worsening > 0) {
    return \${worsening} area(s) showing concerning signals\;
  } else if (improving > 0) {
    return \${improving} area(s) showing improvement\;
  } else {
    return 'No meaningful changes detected'\;
  }
}

/**
 * Recompile a situation (alias for processSituationInput for compatibility)
 */
export async function processSituationRecompile(input: {
  raw_input: string;
  caregiver_id?: string;
  care_recipient_id?: string;
  care_session_id?: string;
  timestamp?: string;
  source?: 'user_input' | 'document';
}): Promise<SituationResponse> {
  return processSituationInput(input);
}

/**
 * Process session re-entry
 */
export async function processSessionReentry(input: {
  raw_input: string;
  caregiver_id?: string;
  care_recipient_id?: string;
  care_session_id?: string;
  timestamp?: string;
  source?: 'user_input' | 'document';
}): Promise<SituationResponse> {
  return processSituationInput(input);
}

/**
 * Get situation timeline (simplified)
 */
export function getSituationTimeline(): string[] {
  return [];
}

/**
 * Get top situation events (simplified)
 */
export function getTopSituationEvents(): CanonicalCareEvent[] {
  return [];
}
`, 'utf8');

console.log('Pipeline file written');

 // Now try to import and use it
console.log("\nAttempting to import and use the module...");
(async () => {
  try {
    const { processSituationInput } = await import('./src/lib/situation-entry/pipeline');
    console.log("Import successful");
    
    // Test the function with a simple input
    try {
      const result = await processSituationInput({
        raw_input: "Test input for verification",
        caregiver_id: "test_caregiver_123"
      });
      console.log("Function call successful:");
      console.log("Returned object keys:", Object.keys(result));
      console.log("Has care_state_change_report:", !!result.care_state_change_report);
      if (result.care_state_change_report) {
        console.log("care_state_change_report has has_meaningful_change:", result.care_state_change_report.has_meaningful_change);
        console.log("trajectory_summary:", result.care_state_change_report.trajectory_summary);
      }
    } catch (error) {
      console.error("Error calling function:", error);
    }
  } catch (error) {
    console.error("Error importing module:", error);
  }
})();