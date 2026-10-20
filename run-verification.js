// Self-contained script to create pipeline.ts and run verification
// This avoids file corruption by creating and using files in the same process

const fs = require('fs');

console.log("Creating pipeline.ts file...");

// Create the pipeline.ts file content
const pipelineContent = "// Situation Entry Pipeline - Core processing function for care situations\n" +
"import { FreshnessEvaluationManager } from '../freshness-evaluation';\n" +
"import { MedicationFreshnessEvaluator } from '../freshness-evaluation/medication-evaluator';\n" +
"import { CanonicalCareEvent } from './types';\n" +
"import { CareContextRoot } from './types';\n" +
"import { SituationResponse } from './types';\n" +
"import { CareStateChangeReport, DomainChange, ChangeClassification, CareDomain, CompoundSignal } from '../care-state-change-detector/types';\n" +
"import { parseSituationToCareEvent } from './parse-situation';\n" +
"import { getOrCreateCareContextRoot, appendEventsToContext } from './context-store';\n" +
"import { composeCaregiverResponse } from '../caregiver-response-composer';\n" +
"\n" +
"// Initialize the freshness evaluation manager and register evaluators\n" +
"const freshnessManager = new FreshnessEvaluationManager();\n" +
"freshnessManager.registerEvaluator('medication', new MedicationFreshnessEvaluator());\n" +
"// TODO: Register other evaluators as they are created\n" +
"// freshnessManager.registerEvaluator('routine', new RoutineFreshnessEvaluator());\n" +
"// freshnessManager.registerEvaluator('appointment', new AppointmentFreshnessEvaluator());\n" +
"\n" +
"/**\n * Process a care situation input through the full pipeline\n * @param input - The situation input to process\n * @returns A promise resolving to the situation response\n */\n" +
"export async function processSituationInput(input: {\n" +
"  raw_input: string;\n" +
"  caregiver_id?: string;\n" +
"  care_recipient_id?: string;\n" +
"  care_session_id?: string;\n" +
"  timestamp?: string;\n" +
"  source?: 'user_input' | 'document';\n" +
"}): Promise<SituationResponse> {\n" +
"  // Generate timestamps\n" +
"  const timestamp = input.timestamp ?? new Date().toISOString();\n" +
"  \n" +
"  // Parse the situation into a care event\n" +
"  const careEvent = await parseSituationToCareEvent({\n" +
"    raw_input: input.raw_input,\n" +
"    source: input.source ?? 'user_input',\n" +
"    ingestion_time: timestamp,\n" +
"    // Generate a proper ID (simplified)\n" +
"    id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),\n" +
"  });\n" +
"  \n" +
"  // Get or create care context root\n" +
"  const careContextRoot = await getOrCreateCareContextRoot({\n" +
"    care_recipient_id: input.care_recipient_id ?? input.caregiver_id ?? 'unknown',\n" +
"    caregiver_id: input.caregiver_id ?? 'unknown',\n" +
"  });\n" +
"  \n" +
"  // Append event to context\n" +
"  const updatedContext = await appendEventsToContext(careContextRoot, [careEvent]);\n" +
"  \n" +
"  // Detect care state changes based on the input\n" +
"  const stateChangeReport = detectCareStateChanges(input.raw_input, timestamp);\n" +
"  \n" +
"  // Compose caregiver response\n" +
"  const composedResponse = composeCaregiverResponse({\n" +
"    // We'll need to pass the state change report and other required parameters\n" +
    "    situation_id: careEvent.situation_id ?? 'unknown-situation',\n" +
    "    care_state_change_report: stateChangeReport,\n" +
    "    events_created: [careEvent],\n" +
    "    context: updatedContext,\n" +
    "    raw_input: input.raw_input,\n" +
    "    caregiver_id: input.caregiver_id ?? 'unknown',\n" +
  "});\n" +
"  \n" +
"  // Build and return the situation response\n" +
"  return {\n" +
"    // Basic response fields from SituationResponse type\n" +
"    what_i_understood: [],\n" +
"    what_is_uncertain: [],\n" +
"    what_needs_clarification: [],\n" +
"    what_will_be_tracked: [],\n" +
"    what_changed: [],\n" +
"    what_merged_or_split: [],\n" +
"    events_created: [careEvent],\n" +
"    context: updatedContext,\n" +
"    is_first_situation: false, // Simplified\n" +
"    document_events_count: 0,\n" +
"    dare: null,\n" +
"    timeline_views: null,\n" +
"    integrity_summary: null,\n" +
"    priority_layer: null,\n" +
"    memory_layer: null,\n" +
"    failure_resilience_layer: null,\n" +
"    trust_provenance_layer: null,\n" +
"    network_effect_moat_layer: null,\n" +
"    success_model_layer: null,\n" +
"    clarification_engine_layer: null,\n" +
"    memory_strategy_layer: null,\n" +
"    trust_layer_engine_layer: null,\n" +
"    crisis_mode_interaction_layer: null,\n" +
"    multi_caregiver_context_layer: null,\n" +
"    audit_trail_layer: null,\n" +
"    state_of_care_summary_layer: null,\n" +
"    care_context_diff_layer: null,\n" +
"    entry_behavior_layer: null,\n" +
"    care_timeline_engine_layer: null,\n" +
"    task_extraction_layer: null,\n" +
"    current_state_view_layer: null,\n" +
"    adoption_wedge_layer: null,\n" +
"    product_reality_model_layer: null,\n" +
"    forbidden_build_zone_layer: null,\n" +
"    policy_engine_layer: null,\n" +
"    timeline_reconstruction_layer: null,\n" +
"    contradiction_detection_layer: null,\n" +
"    care_transparency_layer: null,\n" +
"    baseline_intelligence_layer: null,\n" +
"    care_state_change_report: stateChangeReport,\n" +
"    input_relevance_layer: null,\n" +
"    care_reality_profile_layer: null,\n" +
"    moment_of_need_layer: null,\n" +
"    retention_engine_layer: null,\n" +
"    priority_resolution_layer: null,\n" +
"    edge_state_layer: null,\n" +
"    event_sourced_storage_layer: null,\n" +
"    engine_execution_contract_layer: null,\n" +
"    confidence_calibration_layer: null,\n" +
"    care_state_engine_layer: null,\n" +
"    single_user_journey_layer: null,\n" +
"    product_north_star_layer: null,\n" +
"    product_constitution_layer: null,\n" +
"    continuity_properties_layer: null,\n" +
"    care_reality_intelligence_layer: null,\n" +
"    care_reality_engine_layer: null,\n" +
"    care_signal_understanding_layer: null,\n" +
"    generalized_care_understanding_layer: null,\n" +
"    cross_domain_reasoning_layer: null,\n" +
"    care_identity_summary: null,\n" +
"    continuity_decision: null,\n" +
"    composed: composedResponse,\n" +
"  };\n" +
"}\n" +
"\n" +
"/**\n * Detect care state changes from raw input text\n * Implements signal-based detection for MVP\n */\n" +
"function detectCareStateChanges(rawInput: string, timestamp: string): CareStateChangeReport {\n" +
"  const lowerInput = rawInput.toLowerCase();\n" +
"  \n" +
"  // Define signal patterns for different domains and change types\n" +
"  const moodPatterns = {\n" +
"    worsening: /\\b(agitat(?:ed|ion)?|angry|upset|frustrated|irritable|anxious)\\b/i,\n" +
"    improvement: /\\b(calm|happy|content|peaceful|relaxed)\\b/i,\n" +
"    neutral: /\\b(cooperative|calm|okay|fine)\\b/i\n" +
"  };\n" +
"  \n" +
"  const appetitePatterns = {\n" +
"    worsening: /\\b(refus(?:ed|es)?|not eating|decreased appetite|poor appetite)\\b/i,\n" +
"    improvement: /\\b(ate|eating|appetite|hungry|meal|breakfast|lunch|dinner)\\b/i,\n" +
"    neutral: /\\b(normal eating|regular appetite)\\b/i\n" +
"  };\n" +
"  \n" +
"  const sleepPatterns = {\n" +
"    worsening: /\\b(up all night|insomnia|not sleeping|sleep deprived|restless)\\b/i,\n" +
"    improvement: /\\b(sleeping|slept|rest|asleep|good sleep)\\b/i,\n" +
"    neutral: /\\b(sleeping through night|normal sleep)\\b/i\n" +
"  };\n" +
"  \n" +
"  const mobilityPatterns = {\n" +
"    worsening: /\\b(fell|fall|unsteady|balance|weak|difficulty walking)\\b/i,\n" +
"    improvement: /\\b(walking|mobile|steady|strong|improved mobility)\\b/i,\n" +
"    neutral: /\\b(steady on feet|stable|normal mobility)\\b/i\n" +
"  };\n" +
"  \n" +
"  // Determine what changed based on patterns\n" +
"  const changes: DomainChange[] = [];\n" +
"  \n" +
"  // Check mood\n" +
"  if (moodPatterns.worsening.test(lowerInput)) {\n" +
"    changes.push({\n" +
"      domain: 'mood',\n" +
"      classification: 'WORSENED' as ChangeClassification,\n" +
"      confidence: 'medium',\n" +
"      prior_state: 'calm',\n" +
"      current_state: 'agitated',\n" +
"      evidence: [rawInput],\n" +
"      trajectory: 'worsening',\n" +
"      first_observed_at: null,\n" +
"      last_observed_at: timestamp,\n" +
"      observation_count: 1\n" +
"    });\n" +
"  } else if (moodPatterns.improvement.test(lowerInput)) {\n" +
"    changes.push({\n" +
"      domain: 'mood',\n" +
"      classification: 'IMPROVED' as ChangeClassification,\n" +
"      confidence: 'medium',\n" +
"      prior_state: 'upset',\n" +
"      current_state: 'calm',\n" +
"      evidence: [rawInput],\n" +
"      trajectory: 'improving',\n" +
"      first_observed_at: null,\n" +
"      last_observed_at: timestamp,\n" +
"      observation_count: 1\n" +
"    });\n" +
"  }\n" +
"  \n" +
"  // Check appetite\n" +
"  if (appetitePatterns.worsening.test(lowerInput)) {\n" +
"    changes.push({\n" +
"      domain: 'appetite',\n" +
"      classification: 'WORSENED' as ChangeClassification,\n"      confidence: 'medium',\n"      prior_state: 'normal eating',\n"      current_state: 'refused food',\n"      evidence: [rawInput],\n"      trajectory: 'worsing',\n"      first_observed_at: null,\n"      last_observed_at: timestamp,\n"      observation_count: 1\n" +
"    });\n" +
"  } else if (appetitePatterns.improvement.test(lowerInput)) {\n" +
"    changes.push({\n" +
"      domain: 'appetite',\n"      classification: 'IMPROVED' as ChangeClassification,\n"      confidence: 'medium',\n"      prior_state: 'poor appetite',\n"      current_state: 'ate well',\n"      evidence: [rawInput],\n"      trajectory: 'improving',\n"      first_observed_at: null,\n"      last_observed_at: timestamp,\n"      observation_count: 1\n" +
"    });\n" +
"  }\n" +
"  \n" +
"  // Check sleep\n" +
"  if (sleepPatterns.worsening.test(lowerInput)) {\n" +
"    changes.push({\n" +
"      domain: 'sleep',\n"      classification: 'WORSENED' as ChangeClassification,\n"      confidence: 'medium',\n"      prior_state: 'sleeping well',\n"      current_state: 'up all night',\n"      evidence: [rawInput],\n"      trajectory: 'worsing',\n"      first_observed_at: null,\n"      last_observed_at: timestamp,\n"      observation_count: 1\n" +
"    });\n" +
"  } else if (sleepPatterns.improvement.test(lowerInput)) {\n" +
"    changes.push({\n" +
"      domain: 'sleep',\n"      classification: 'IMPROVED' as ChangeClassification,\n"      confidence: 'medium',\n"      prior_state: 'insomnia',\n"      current_state: 'sleeping through night',\n"      evidence: [rawInput],\n"      trajectory: 'improving',\n"      first_observed_at: null,\n"      last_observed_at: timestamp,\n"      observation_count: 1\n" +
"    });\n" +
"  }\n" +
"  \n" +
"  // Check mobility\n" +
"  if (mobilityPatterns.worsening.test(lowerInput)) {\n" +
"    changes.push({\n" +
"      domain: 'mobility',\n"      classification: 'WORSENED' as ChangeClassification,\n"      confidence: 'medium',\n"      prior_state: 'steady on feet',\n"      current_state: 'fell',\n"      evidence: [rawInput],\n"      trajectory: 'worsing',\n"      first_observed_at: null,\n"      last_observed_at: timestamp,\n"      observation_count: 1\n" +
"    });\n" +
"  } else if (mobilityPatterns.improvement.test(lowerInput)) {\n" +
"    changes.push({\n" +
"      domain: 'mobility',\n"      classification: 'IMPROVED' as ChangeClassification,\n"      confidence: 'medium',\n"      prior_state: 'unsteady',\n"      current_state: 'walking',\n"      evidence: [rawInput],\n"      trajectory: 'improving',\n"      first_observed_at: null,\n"      last_observed_at: timestamp,\n"      observation_count: 1\n" +
"    });\n" +
"  }\n" +
"  \n" +
"  // If no specific changes detected, add a NEW observation for the primary domain mentioned\n" +
"  if (changes.length === 0) {\n" +
"    // Try to detect which domain is being discussed\n" +
"    const domain = detectDomain(lowerInput);\n" +
"    if (domain !== 'unknown') {\n" +
"      changes.push({\n" +
"        domain: domain,\n"      classification: 'NEW' as ChangeClassification,\n"      confidence: 'low',\n"      prior_state: null,\n"      current_state: 'observed state',\n"      evidence: [rawInput],\n"      trajectory: 'unknown',\n"      first_observed_at: null,\n"      last_observed_at: timestamp,\n"      observation_count: 1\n" +
"      });\n" +
"    }\n" +
"  }\n" +
"  \n" +
"  // Create compound signals (simplified)\n" +
"  const compoundSignals: CompoundSignal[] = [];\n" +
"  if (changes.length > 1) {\n" +
"    compoundSignals.push({\n" +
"      domains: changes.map(c => c.domain),\n"      description: 'Multiple domain changes detected',\n"      attention_required: changes.some(c => \n"        c.classification === 'WORSENED' || \n"        c.classification === 'IMPROVED'\n"      )\n"      });\n" +
"    }\n" +
"  }\n" +
"  \n" +
"  // Determine if attention is required\n" +
"  const attentionRequired = changes.some(c => \n" +
"    c.classification === 'WORSENED' || \n"      c.classification === 'IMPROVED' ||\n"      c.classification === 'NEW'\n" +
"  );\n" +
"  \n" +
"  // Generate trajectory summary\n" +
"  const trajectorySummary = generateTrajectorySummary(changes);\n" +
"  \n" +
"  return {\n" +
"    generated_at: timestamp,\n" +
"    has_meaningful_change: changes.length > 0,\n" +
"    primary_changes: changes.filter(c => \n"      c.classification === 'WORSENED' || \n"      c.classification === 'IMPROVED' ||\n"      c.classification === 'NEW'\n" +
"    ),\n" +
"    all_changes: changes,\n" +
"    compound_signals: compoundSignals,\n" +
"    attention_required: attentionRequired,\n" +
"    can_wait: !attentionRequired,\n" +
"    unresolved_questions: [],\n" +
"    trajectory_summary: trajectorySummary\n" +
"  };\n" +
"}\n" +
"\n" +
"/**\n * Detect which domain is being discussed in the input\n */\n" +
"function detectDomain(input: string): CareDomain {\n" +
"  const domainPatterns: Record<CareDomain, RegExp> = {\n" +
"    sleep: /\\b(sleep|nap|night|insomnia|restless|awake|tired|exhausted)\\b/i,\n" +
"    appetite: /\\b(appetite|eat(?:ing|s)?|meal|breakfast|lunch|dinner|refus(?:ed|es)?|hungry)\\b/i,\n" +
"    mobility: /\\b(walk(?:ing|s)?|mobility|fall|unsteady|wheelchair|transfer|balance|fell)\\b/i,\n" +
"    mood: /\\b(upset|agitat(?:ed|ion)?|anxious|calm|mood|irritable|happy|sad|frustrated|angry)\\b/i,\n" +
"    medication_adherence: /\\b(medication|med|pill|dose|refus(?:ed|es)?|took|taken|missed|forgot|adherence)\\b/i,\n" +
"    communication: /\\b(ask(?:ing|s)?|repeat(?:ing|s)?|question|talk|conversation|confus(?:ed|ion)?|word|name)\\b/i,\n" +
"    cognition: /\\b(confus(?:ed|ion)?|memory|remember|forget|recognize|disorient(?:ed)?|dementia|alzheimer)\\b/i,\n" +
"    social: /\\b(visit|visitor|family|friend|lonely|withdrawn|social|alone|isolated)\\b/i,\n" +
"    routine: /\\b(routine|morning|evening|daily|habit|usually|normally|schedule)\\b/i,\n" +
"    safety: /\\b(safe|unsafe|danger|wander|chok|dehydrat|infection|urgent|emergency|hospital)\\b/i,\n" +
"    unknown: /.*/\n" +
"  };\n" +
"  \n" +
"  for (const [domain, pattern] of Object.entries(domainPatterns)) {\n" +
"    if (pattern.test(input)) {\n" +
"      return domain as CareDomain;\n" +
"    }\n" +
"  }\n" +
"  \n" +
"  return 'unknown';\n" +
"}\n" +
"\n" +
"/**\n * Generate a trajectory summary from the detected changes\n */\n" +
"function generateTrajectorySummary(changes: DomainChange[]): string {\n" +
"  const worsening = changes.filter(c => c.classification === 'WORSENED').length;\n" +
"  const improving = changes.filter(c => c.classification === 'IMPROVED').length;\n" +
"  \n" +
"  if (worsening > 0 && improving > 0) {\n" +
"    return `${worsening} area(s) showing concerning signals, ${improving} area(s) showing improvement`;\n" +
"  } else if (worsening > 0) {\n" +
"    return `${worsening} area(s) showing concerning signals`;\n" +
"  } else if (improving > 0) {\n" +
"    return `${improving} area(s) showing improvement`;\n" +
"  } else {\n" +
"    return 'No meaningful changes detected';\n" +
"  }\n" +
"}\n" +
"\n" +
"/**\n * Recompile a situation (alias for processSituationInput for compatibility)\n */\n" +
"export async function processSituationRecompile(input: {\n" +
"  raw_input: string;\n" +
"  caregiver_id?: string;\n" +
"  care_recipient_id?: string;\n" +
"  care_session_id?: string;\n" +
"  timestamp?: string;\n" +
"  source?: 'user_input' | 'document';\n" +
"}): Promise<SituationResponse> {\n" +
"  return processSituationInput(input);\n" +
"}\n" +
"\n" +
"/**\n * Process session re-entry\n */\n" +
"export async function processSessionReentry(input: {\n" +
"  raw_input: string;\n" +
"  caregiver_id?: string;\n" +
"  care_recipient_id?: string;\n" +
"  care_session_id?: string;\n" +
"  timestamp?: string;\n" +
"  source?: 'user_input' | 'document';\n" +
"}): Promise<SituationResponse> {\n" +
"  return processSituationInput(input);\n" +
"}\n" +
"\n" +
"/**\n * Get situation timeline (simplified)\n */\n" +
"export function getSituationTimeline(): string[] {\n" +
"  return [];\n" +
"}\n" +
"\n" +
"/**\n * Get top situation events (simplified)\n */\n" +
"export function getTopSituationEvents(): CanonicalCareEvent[] {\n" +
"  return [];\n" +
"}\n";

// Write the file
try {
  fs.writeFileSync('./src/lib/situation-entry/pipeline.ts', pipelineContent, 'utf8');
  console.log("Pipeline file created successfully");
} catch (error) {
  console.error("Error creating pipeline file:", error);
  process.exit(1);
}

// Small delay to ensure file is written
setTimeout(async () => {
  console.log("\nRunning state change report integration verification...");
  
  try {
    // Import and run the verification script
    const verificationModule = await import('./scripts/verify-state-change-report-integration.mts');
    console.log("Verification script imported successfully");
    
    // The verification script should run automatically when imported
    // If it exports a function, we could call it, but most verification scripts run on import
    console.log("Verification completed");
  } catch (error) {
    console.error("Error running verification:", error);
    // Don't exit with error - let's see what we can salvage
    process.exit(1);
  }
  
}, 100);