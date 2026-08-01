/**
 * Verification: Greeting Orientation Behavioral Architecture.
 *
 * Tests:
 * 1. New caregiver — no care record → readiness for care work
 * 2. Returning caregiver — care memory exists → continuing care record
 * 3. Returning with continuity threads — unresolved hooks → natural reconnection
 * 4. Casual greeting — "hi" → immediate transition to care context
 * 5. "How are you?" — no emotions, operational readiness
 * 6. Gratitude — "thank you" → reinforces continuity
 * 7. Care event — substantive input → no greeting orientation needed
 * 8. Detection functions — isCasualGreetingInput, isHowAreYouInput, isGratitudeInput
 */

import {
  buildGreetingOrientation,
  isCasualGreetingInput,
  isHowAreYouInput,
  isGratitudeInput,
} from "../src/lib/greeting-orientation";
import type { GreetingOrientationContext } from "../src/lib/greeting-orientation/types";
import type { ContinuityDecision } from "../src/lib/care-identity";
import type { CareRealityState } from "../src/lib/care-reality-state/types";

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, label: string): void {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAILED: ${label}`);
  }
}

function assertIncludes(text: string, substring: string, label: string): void {
  const condition = text.toLowerCase().includes(substring.toLowerCase());
  assert(condition, `${label} — should include "${substring}"`);
}

function assertNotIncludes(text: string, substring: string, label: string): void {
  const condition = !text.toLowerCase().includes(substring.toLowerCase());
  assert(condition, `${label} — should NOT include "${substring}"`);
}

function newContinuityDecision(overrides?: Partial<ContinuityDecision>): ContinuityDecision {
  return {
    continuity_type: "new_caregiver",
    identity: null,
    input_relation: {
      same_recipient: false,
      is_new_information: false,
      is_continuation: false,
      describes_change: false,
      is_correction: false,
      is_emotional_only: false,
      is_question: false,
    },
    care_reality_diff: {
      confirmed: [],
      added: [],
      contradicted: [],
      changed: [],
      remaining_unknowns: [],
      new_unknowns: [],
    },
    can_orient: false,
    context: {
      continuity_type: "new_caregiver",
      identity: null,
      prior_events_exist: false,
      prior_decisions_exist: false,
      prior_unknowns_exist: false,
      prior_observations_exist: false,
      open_uncertainties: [],
      continuity_hooks: [],
      care_reality_state_summary: null,
      prior_decisions: [],
    },
    should_acknowledge_return: false,
    should_orient_new_user: true,
    ...overrides,
  };
}

function makeEmptyContext(overrides?: Partial<GreetingOrientationContext>): GreetingOrientationContext {
  return {
    is_first_session: true,
    continuity: newContinuityDecision(),
    identity: {
      care_recipient_id: "",
      display_name: null,
      relationship: null,
      lifecycle: "potential",
      has_active_care: false,
      last_active_at: "",
    },
    crs: null,
    memory: {
      has_events: false,
      has_observations: false,
      has_decisions: false,
      has_open_unknowns: false,
      event_count: 0,
      observation_count: 0,
      top_observations: [],
      top_events: [],
      open_unknowns: [],
      continuity_hooks: [],
    },
    raw_input: "",
    is_casual_greeting: false,
    is_how_are_you: false,
    is_gratitude: false,
    ...overrides,
  };
}

// ── Test 1: New caregiver ──
console.log("\n📋 Test 1: New caregiver — no care record");
{
  const ctx = makeEmptyContext({
    is_first_session: true,
    is_casual_greeting: true,
    raw_input: "hi",
  });
  const output = buildGreetingOrientation(ctx);
  assert(output.should_orient, "should orient");
  assert(output.orientation_kind === "new_caregiver", "orientation_kind should be new_caregiver");
  assert(output.orientation_line !== null, "orientation_line should not be null");
  assertIncludes(output.orientation_line!, "share information", "should invite sharing");
  assertNotIncludes(output.orientation_line!, "how can I help", "no chatbot language");
  assertNotIncludes(output.orientation_line!, "I'm here for you", "no companion language");
  assertNotIncludes(output.orientation_line!, "assistant", "no assistant framing");
}

// ── Test 2: Returning caregiver ──
console.log("\n📋 Test 2: Returning caregiver — care memory exists");
{
  const ctx = makeEmptyContext({
    is_first_session: false,
    continuity: newContinuityDecision({
      continuity_type: "returning",
      should_acknowledge_return: true,
      should_orient_new_user: false,
      input_relation: {
        same_recipient: true,
        is_new_information: false,
        is_continuation: true,
        describes_change: false,
        is_correction: false,
        is_emotional_only: false,
        is_question: false,
      },
      context: {
        continuity_type: "returning",
        identity: null,
        prior_events_exist: true,
        prior_decisions_exist: false,
        prior_unknowns_exist: false,
        prior_observations_exist: true,
        open_uncertainties: [],
        continuity_hooks: [],
        care_reality_state_summary: ["Mom has been experiencing mobility changes"],
        prior_decisions: [],
      },
    }),
    identity: {
      care_recipient_id: "test_recipient",
      display_name: null,
      relationship: null,
      lifecycle: "active_care",
      has_active_care: true,
      last_active_at: new Date().toISOString(),
    },
    crs: {
      id: "test_crs",
      care_recipient_id: "test_recipient",
      caregiver_id: "test_caregiver",
      care_recipient_label: "Mom",
      updated_at: new Date().toISOString(),
      situation_id: null,
      root_event_id: null,
      understanding_stage: "forming",
      disclosure_stage: "forming",
      current_understanding: ["Mom has been experiencing mobility changes"],
      supporting_evidence: [],
      situation_summary: null,
      pattern_label: null,
      what_matters_now: null,
      open_uncertainties: [],
      resolved_uncertainties: [],
      what_changed_in_understanding: null,
      understanding_effect: "continues_gathering",
      response_evolution: {
        updates_active_situation: true,
        answers_previous_uncertainty: false,
        strengthens_existing_hypothesis: true,
        introduces_new_pattern: false,
        changes_what_matters_now: true,
        invalidates_previous_understanding: false,
      },
      primary_screen_question: "",
      observation_count: 3,
      revision: 2,
      continuity_hooks: [],
      understanding_revisions: [],
    },
    memory: {
      has_events: true,
      has_observations: true,
      has_decisions: false,
      has_open_unknowns: false,
      event_count: 2,
      observation_count: 3,
      top_observations: ["Mobility changes noticed"],
      top_events: ["Hospital discharge last week"],
      open_unknowns: [],
      continuity_hooks: [],
    },
    is_casual_greeting: true,
    raw_input: "hello",
  });
  const output = buildGreetingOrientation(ctx);
  assert(output.should_orient, "should orient");
  assert(output.orientation_kind === "returning_no_threads", "should be returning_no_threads");
  assert(output.orientation_line !== null, "orientation_line should not be null");
  assertIncludes(output.orientation_line!, "Mom", "should reference care recipient");
  assertIncludes(output.orientation_line!, "What has changed", "should ask about changes");
  assertNotIncludes(output.orientation_line!, "nice to see you", "no social language");
  assertNotIncludes(output.orientation_line!, "good to have you back", "no social language");
}

// ── Test 3: Returning with continuity threads ──
console.log("\n📋 Test 3: Returning caregiver with open continuity threads");
{
  const ctx = makeEmptyContext({
    is_first_session: false,
    continuity: newContinuityDecision({
      continuity_type: "returning",
      should_acknowledge_return: true,
      should_orient_new_user: false,
      input_relation: {
        same_recipient: true,
        is_new_information: false,
        is_continuation: true,
        describes_change: false,
        is_correction: false,
        is_emotional_only: false,
        is_question: false,
      },
      context: {
        continuity_type: "returning",
        identity: null,
        prior_events_exist: true,
        prior_decisions_exist: true,
        prior_unknowns_exist: true,
        prior_observations_exist: true,
        open_uncertainties: ["When the medication was changed"],
        continuity_hooks: ["monitoring medication timing alongside recent changes"],
        care_reality_state_summary: ["Dad's medication was changed two weeks ago"],
        prior_decisions: [],
      },
    }),
    identity: {
      care_recipient_id: "test_recipient",
      display_name: null,
      relationship: null,
      lifecycle: "active_care",
      has_active_care: true,
      last_active_at: new Date().toISOString(),
    },
    crs: {
      id: "test_crs",
      care_recipient_id: "test_recipient",
      caregiver_id: "test_caregiver",
      care_recipient_label: "Dad",
      updated_at: new Date().toISOString(),
      situation_id: null,
      root_event_id: null,
      understanding_stage: "synthesizing",
      disclosure_stage: "established",
      current_understanding: ["Dad's medication was changed two weeks ago"],
      supporting_evidence: [],
      situation_summary: null,
      pattern_label: null,
      what_matters_now: null,
      open_uncertainties: ["When the medication was changed"],
      resolved_uncertainties: [],
      what_changed_in_understanding: null,
      understanding_effect: "strengthens_pattern",
      response_evolution: {
        updates_active_situation: true,
        answers_previous_uncertainty: false,
        strengthens_existing_hypothesis: true,
        introduces_new_pattern: false,
        changes_what_matters_now: false,
        invalidates_previous_understanding: false,
      },
      primary_screen_question: "",
      observation_count: 5,
      revision: 3,
      continuity_hooks: ["monitoring medication timing alongside recent changes"],
      understanding_revisions: [],
    },
    memory: {
      has_events: true,
      has_observations: true,
      has_decisions: true,
      has_open_unknowns: true,
      event_count: 3,
      observation_count: 5,
      top_observations: ["Medication changed two weeks ago", "Seems more tired lately"],
      top_events: ["Medication change", "Doctor visit"],
      open_unknowns: ["When the medication was changed"],
      continuity_hooks: ["monitoring medication timing alongside recent changes"],
    },
    is_casual_greeting: true,
    raw_input: "hi",
  });
  const output = buildGreetingOrientation(ctx);
  assert(output.should_orient, "should orient");
  assert(output.orientation_kind === "returning_with_threads", "should be returning_with_threads");
  assert(output.orientation_line !== null, "orientation_line should not be null");
  assertIncludes(output.orientation_line!, "medication", "should reference medication thread");
  assertIncludes(output.orientation_line!, "Dad", "should reference care recipient");
  assertNotIncludes(output.orientation_line!, "I remember from", "no chat memory language");
  assertNotIncludes(output.orientation_line!, "your previous conversation", "no chat framing");
}

// ── Test 4: Casual greeting ──
console.log("\n📋 Test 4: Casual greeting — 'hi' → transition to care");
{
  // With care record
  const ctxWithRecord = makeEmptyContext({
    is_first_session: false,
    continuity: newContinuityDecision({
      continuity_type: "returning",
      should_acknowledge_return: true,
      should_orient_new_user: false,
      input_relation: {
        same_recipient: true,
        is_new_information: false,
        is_continuation: false,
        describes_change: false,
        is_correction: false,
        is_emotional_only: false,
        is_question: false,
      },
      context: {
        continuity_type: "returning",
        identity: null,
        prior_events_exist: true,
        prior_decisions_exist: false,
        prior_unknowns_exist: false,
        prior_observations_exist: true,
        open_uncertainties: [],
        continuity_hooks: [],
        care_reality_state_summary: null,
        prior_decisions: [],
      },
    }),
    identity: {
      care_recipient_id: "test_recipient",
      display_name: null,
      relationship: null,
      lifecycle: "active_care",
      has_active_care: true,
      last_active_at: new Date().toISOString(),
    },
    crs: {
      id: "test_crs",
      care_recipient_id: "test_recipient",
      caregiver_id: "test_caregiver",
      care_recipient_label: "Mom",
      updated_at: new Date().toISOString(),
      situation_id: null,
      root_event_id: null,
      understanding_stage: "forming",
      disclosure_stage: "forming",
      current_understanding: [],
      supporting_evidence: [],
      situation_summary: null,
      pattern_label: null,
      what_matters_now: null,
      open_uncertainties: [],
      resolved_uncertainties: [],
      what_changed_in_understanding: null,
      understanding_effect: "continues_gathering",
      response_evolution: {
        updates_active_situation: false,
        answers_previous_uncertainty: false,
        strengthens_existing_hypothesis: false,
        introduces_new_pattern: false,
        changes_what_matters_now: false,
        invalidates_previous_understanding: false,
      },
      primary_screen_question: "",
      observation_count: 2,
      revision: 1,
      continuity_hooks: [],
      understanding_revisions: [],
    },
    memory: {
      has_events: true,
      has_observations: true,
      has_decisions: false,
      has_open_unknowns: false,
      event_count: 1,
      observation_count: 2,
      top_observations: ["Fall last week"],
      top_events: ["Fall incident"],
      open_unknowns: [],
      continuity_hooks: [],
    },
    is_casual_greeting: true,
    raw_input: "good morning",
  });
  const output = buildGreetingOrientation(ctxWithRecord);
  assert(output.should_orient, "should orient with record");
  assert(output.orientation_line !== null, "orientation_line should not be null");
  assertIncludes(output.orientation_line!, "held", "should reference held updates");

  // No care record
  const ctxEmpty = makeEmptyContext({
    is_first_session: true,
    is_casual_greeting: true,
    raw_input: "hello",
  });
  const emptyOutput = buildGreetingOrientation(ctxEmpty);
  assert(emptyOutput.orientation_kind === "new_caregiver", "empty record → new_caregiver");
}

// ── Test 5: "How are you?" ──
console.log("\n📋 Test 5: 'How are you?' — operational readiness, not emotions");
{
  const ctx = makeEmptyContext({
    is_first_session: false,
    continuity: newContinuityDecision({
      continuity_type: "returning",
      should_acknowledge_return: true,
      should_orient_new_user: false,
      input_relation: {
        same_recipient: true,
        is_new_information: false,
        is_continuation: false,
        describes_change: false,
        is_correction: false,
        is_emotional_only: false,
        is_question: false,
      },
      context: {
        continuity_type: "returning",
        identity: null,
        prior_events_exist: true,
        prior_decisions_exist: false,
        prior_unknowns_exist: false,
        prior_observations_exist: true,
        open_uncertainties: [],
        continuity_hooks: [],
        care_reality_state_summary: null,
        prior_decisions: [],
      },
    }),
    identity: {
      care_recipient_id: "test_recipient",
      display_name: null,
      relationship: null,
      lifecycle: "active_care",
      has_active_care: true,
      last_active_at: new Date().toISOString(),
    },
    crs: {
      id: "test_crs",
      care_recipient_id: "test_recipient",
      caregiver_id: "test_caregiver",
      care_recipient_label: "Mom",
      updated_at: new Date().toISOString(),
      situation_id: null,
      root_event_id: null,
      understanding_stage: "forming",
      disclosure_stage: "forming",
      current_understanding: [],
      supporting_evidence: [],
      situation_summary: null,
      pattern_label: null,
      what_matters_now: null,
      open_uncertainties: [],
      resolved_uncertainties: [],
      what_changed_in_understanding: null,
      understanding_effect: "continues_gathering",
      response_evolution: {
        updates_active_situation: false,
        answers_previous_uncertainty: false,
        strengthens_existing_hypothesis: false,
        introduces_new_pattern: false,
        changes_what_matters_now: false,
        invalidates_previous_understanding: false,
      },
      primary_screen_question: "",
      observation_count: 2,
      revision: 1,
      continuity_hooks: [],
      understanding_revisions: [],
    },
    memory: {
      has_events: true,
      has_observations: true,
      has_decisions: false,
      has_open_unknowns: false,
      event_count: 1,
      observation_count: 2,
      top_observations: ["Recent changes"],
      top_events: [],
      open_unknowns: [],
      continuity_hooks: [],
    },
    is_how_are_you: true,
    raw_input: "how are you",
  });
  const output = buildGreetingOrientation(ctx);
  assert(output.should_orient, "should orient");
  assert(output.orientation_kind === "how_are_you", "orientation_kind should be how_are_you");
  assert(output.orientation_line !== null, "orientation_line should not be null");
  assertIncludes(output.orientation_line!, "care record", "should reference care record");
  assertNotIncludes(output.orientation_line!, "I'm doing great", "no emotions");
  assertNotIncludes(output.orientation_line!, "I'm happy", "no happiness claims");
  assertNotIncludes(output.orientation_line!, "I'm here for you", "no companion language");
  assertNotIncludes(output.orientation_line!, "I understand", "no empathy simulation");
}

// ── Test 6: Gratitude ──
console.log("\n📋 Test 6: 'Thank you' — reinforces continuity");
{
  const ctx = makeEmptyContext({
    is_first_session: false,
    continuity: newContinuityDecision({
      continuity_type: "returning",
      should_acknowledge_return: true,
      should_orient_new_user: false,
      input_relation: {
        same_recipient: true,
        is_new_information: false,
        is_continuation: false,
        describes_change: false,
        is_correction: false,
        is_emotional_only: false,
        is_question: false,
      },
      context: {
        continuity_type: "returning",
        identity: null,
        prior_events_exist: true,
        prior_decisions_exist: false,
        prior_unknowns_exist: false,
        prior_observations_exist: true,
        open_uncertainties: [],
        continuity_hooks: [],
        care_reality_state_summary: null,
        prior_decisions: [],
      },
    }),
    identity: {
      care_recipient_id: "test_recipient",
      display_name: null,
      relationship: null,
      lifecycle: "active_care",
      has_active_care: true,
      last_active_at: new Date().toISOString(),
    },
    crs: {
      id: "test_crs",
      care_recipient_id: "test_recipient",
      caregiver_id: "test_caregiver",
      care_recipient_label: null,
      updated_at: new Date().toISOString(),
      situation_id: null,
      root_event_id: null,
      understanding_stage: "forming",
      disclosure_stage: "forming",
      current_understanding: [],
      supporting_evidence: [],
      situation_summary: null,
      pattern_label: null,
      what_matters_now: null,
      open_uncertainties: [],
      resolved_uncertainties: [],
      what_changed_in_understanding: null,
      understanding_effect: "continues_gathering",
      response_evolution: {
        updates_active_situation: false,
        answers_previous_uncertainty: false,
        strengthens_existing_hypothesis: false,
        introduces_new_pattern: false,
        changes_what_matters_now: false,
        invalidates_previous_understanding: false,
      },
      primary_screen_question: "",
      observation_count: 2,
      revision: 1,
      continuity_hooks: [],
      understanding_revisions: [],
    },
    memory: {
      has_events: true,
      has_observations: true,
      has_decisions: false,
      has_open_unknowns: false,
      event_count: 1,
      observation_count: 2,
      top_observations: ["Recent mobility changes"],
      top_events: [],
      open_unknowns: [],
      continuity_hooks: [],
    },
    is_gratitude: true,
    raw_input: "thank you",
  });
  const output = buildGreetingOrientation(ctx);
  assert(output.should_orient, "should orient");
  assert(output.orientation_kind === "gratitude", "orientation_kind should be gratitude");
  assert(output.orientation_line !== null, "orientation_line should not be null");
  assertIncludes(output.orientation_line!, "held", "should reference held information");
  assertIncludes(output.orientation_line!, "Return whenever", "should reinforce continuity");
  assertNotIncludes(output.orientation_line!, "you're welcome", "no chat closing");
  assertNotIncludes(output.orientation_line!, "happy to help", "no companion language");
}

// ── Test 7: Care event input → no greeting orientation ──
console.log("\n📋 Test 7: Substantive care event — no orientation needed");
{
  const ctx = makeEmptyContext({
    is_first_session: false,
    is_casual_greeting: false,
    is_how_are_you: false,
    is_gratitude: false,
    raw_input: "Mom fell today and hurt her hip",
    continuity: newContinuationDecision({
      continuity_type: "returning",
      should_acknowledge_return: true,
      should_orient_new_user: false,
      input_relation: {
        same_recipient: true,
        is_new_information: true,
        is_continuation: false,
        describes_change: true,
        is_correction: false,
        is_emotional_only: false,
        is_question: false,
      },
      care_reality_diff: {
        confirmed: [],
        added: ["New fall incident"],
        changed: [],
        contradicted: [],
        remaining_unknowns: [],
        new_unknowns: [],
      },
      context: {
        continuity_type: "returning",
        identity: null,
        prior_events_exist: true,
        prior_decisions_exist: false,
        prior_unknowns_exist: false,
        prior_observations_exist: true,
        open_uncertainties: [],
        continuity_hooks: [],
        care_reality_state_summary: null,
        prior_decisions: [],
      },
    }),
  });
  const output = buildGreetingOrientation(ctx);
  assert(!output.should_orient, "should NOT orient on substantive input");
  assert(output.orientation_line === null, "orientation_line should be null");
  assert(output.orientation_kind === "none", "orientation_kind should be none");
}

// ── Test 8: Detection functions ──
console.log("\n📋 Test 8: Detection functions");
{
  // isCasualGreetingInput
  assert(isCasualGreetingInput("hi"), "detects 'hi'");
  assert(isCasualGreetingInput("Hello"), "detects 'Hello'");
  assert(isCasualGreetingInput("good morning"), "detects 'good morning'");
  assert(isCasualGreetingInput("hey solenos"), "detects 'hey solenos'");
  assert(!isCasualGreetingInput("Mom fell today"), "rejects care content");
  assert(!isCasualGreetingInput(""), "rejects empty");
  assert(!isCasualGreetingInput("thank you"), "rejects gratitude");

  // isHowAreYouInput
  assert(isHowAreYouInput("how are you"), "detects 'how are you'");
  assert(isHowAreYouInput("How is it going"), "detects 'How is it going'");
  assert(isHowAreYouInput("how's things"), "detects 'how's things'");
  assert(!isHowAreYouInput("how do I change medication"), "rejects care question");

  // isGratitudeInput
  assert(isGratitudeInput("thanks"), "detects 'thanks'");
  assert(isGratitudeInput("Thank you"), "detects 'Thank you'");
  assert(isGratitudeInput("appreciate it"), "detects 'appreciate it'");
  assert(!isGratitudeInput("Mom fell today"), "rejects care content");
}

// ── Summary ──
console.log(`\n${"-".repeat(40)}`);
console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("✅ All greeting orientation tests passed.");
}
